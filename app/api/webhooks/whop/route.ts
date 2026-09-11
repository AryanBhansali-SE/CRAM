import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasEnv, requireEnv } from "@/lib/env";
import {
  describeShape,
  entitlementFor,
  extractEmail,
  verifyWhopSignature,
  type WhopEvent,
} from "@/lib/whop";

/**
 * Whop webhook receiver — the only thing in the app that grants or revokes paid
 * access.
 *
 * This is a server-to-server call with no user session, so it uses the
 * service-role client deliberately: profiles has select-only RLS precisely so
 * that a user can't grant themselves is_paid, which means the only writer has to
 * be something that bypasses RLS. That makes signature verification the entire
 * security boundary — every path below runs only after the request is proven to
 * come from Whop.
 */

export const maxDuration = 30;

/** Whop retries on 5xx, so the status code is a real decision, not decoration. */
function ack(body: Record<string, unknown>) {
  return NextResponse.json(body, { status: 200 });
}

export async function POST(req: NextRequest) {
  // The signature covers the exact bytes Whop sent, so the raw text has to be
  // read before anything parses it. req.json() here would break verification.
  const body = await req.text();

  if (!hasEnv("WHOP_WEBHOOK_SECRET")) {
    // Failing closed: without the secret nothing can be trusted, and a 500 makes
    // Whop retry once it's configured rather than dropping the upgrade.
    console.error("[whop] WHOP_WEBHOOK_SECRET is not set — rejecting webhook.");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const verdict = verifyWhopSignature({
    id: req.headers.get("webhook-id"),
    timestamp: req.headers.get("webhook-timestamp"),
    signatureHeader: req.headers.get("webhook-signature"),
    body,
    secret: requireEnv("WHOP_WEBHOOK_SECRET"),
  });

  if (!verdict.ok) {
    // 401 and not 5xx: a forged or stale request should never be retried.
    console.warn(`[whop] rejected webhook: ${verdict.reason}`);
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: WhopEvent;
  try {
    event = JSON.parse(body) as WhopEvent;
  } catch {
    console.warn("[whop] signed request had an unparseable body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const type = typeof event.type === "string" ? event.type : "";
  const entitlement = entitlementFor(type);

  // Plenty of Whop events are real but irrelevant here (payment.pending, and so
  // on). Acknowledge them so they aren't retried.
  if (entitlement === null) {
    return ack({ received: true, type, action: "ignored" });
  }

  const email = extractEmail(event.data);

  if (!email) {
    // Never a 5xx: retrying can't conjure an email that isn't in the payload,
    // and a retry loop would bury the one log line that explains the problem.
    console.error(
      `[whop] ${type} carried no recognisable email; cannot match a Cram account. ` +
        `Payload shape: ${describeShape(event.data)}`
    );
    return ack({ received: true, type, action: "no_email_in_payload" });
  }

  try {
    const admin = createAdminClient();
    const userId = await findUserIdByEmail(admin, email);

    if (!userId) {
      // Someone paid on Whop with an address that has no Cram account — they
      // signed up with a different email, or haven't signed up at all. Their
      // money is taken and they have no access, so this needs to be loud.
      console.error(
        `[whop] ${type} for ${redact(email)} matched no Cram account. ` +
          `They likely paid with a different address than they signed up with.`
      );
      return ack({ received: true, type, action: "no_matching_user" });
    }

    const { error } = await admin
      .from("profiles")
      .upsert({ id: userId, is_paid: entitlement }, { onConflict: "id" });

    if (error) throw error;

    console.log(`[whop] ${type}: set is_paid=${entitlement} for ${redact(email)}`);
    return ack({ received: true, type, action: entitlement ? "upgraded" : "downgraded" });
  } catch (err) {
    // A database failure is worth retrying, so this one is a 5xx.
    console.error("[whop] failed to apply entitlement:", err);
    return NextResponse.json({ error: "Could not apply entitlement" }, { status: 500 });
  }
}

/**
 * Finds the Supabase user for an email address.
 *
 * auth.users isn't exposed through PostgREST and the admin list endpoint has no
 * email filter, so this pages through. That's fine at launch scale and the match
 * is usually on the first page; if the user base grows into the thousands, the
 * fix is an indexed email column on profiles rather than more pages here.
 */
async function findUserIdByEmail(
  admin: ReturnType<typeof createAdminClient>,
  email: string
): Promise<string | null> {
  const perPage = 200;
  const maxPages = 20;

  for (let page = 1; page <= maxPages; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const match = data.users.find((user) => user.email?.toLowerCase() === email);
    if (match) return match.id;

    if (data.users.length < perPage) return null;
  }

  console.warn(`[whop] gave up looking for ${redact(email)} after ${maxPages} pages`);
  return null;
}

/** Keeps full addresses out of the logs while staying diagnosable. */
function redact(email: string): string {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  return `${name.slice(0, 2)}***@${domain}`;
}
