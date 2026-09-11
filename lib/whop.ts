import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Whop webhook plumbing: signature verification, event interpretation, and
 * working out which Cram account a payment belongs to.
 *
 * Whop implements the Standard Webhooks specification, so the signature covers
 * `{webhook-id}.{webhook-timestamp}.{raw body}` with HMAC-SHA256 and arrives
 * base64-encoded in a `webhook-signature` header.
 */

/** Reject anything older than this, so a captured request can't be replayed. */
export const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export type WhopEvent = {
  id?: string;
  type?: string;
  data?: unknown;
};

/**
 * Whether a signature is genuine.
 *
 * Two details make this fiddlier than a plain HMAC compare:
 *
 * 1. The header can carry several space-separated versioned signatures
 *    ("v1,<sig> v1,<sig2>") during a secret rotation. Any one matching is a
 *    pass, which is what makes rotation possible without dropping deliveries.
 *
 * 2. Whop hands out the secret as a `ws_…` string and says to pass it along
 *    untouched, while the Standard Webhooks spec derives the key by stripping
 *    the prefix and base64-decoding the rest. Rather than bet on one reading and
 *    have every delivery fail, both derivations are accepted. That costs nothing
 *    in security — each still requires the secret, which only Whop holds.
 */
export function verifyWhopSignature({
  id,
  timestamp,
  signatureHeader,
  body,
  secret,
  now = Date.now(),
}: {
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  body: string;
  secret: string;
  now?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!id || !timestamp || !signatureHeader) {
    return { ok: false, reason: "missing webhook-id, webhook-timestamp or webhook-signature" };
  }

  // Standard Webhooks sends seconds since the epoch.
  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, reason: "webhook-timestamp is not a number" };
  }
  const driftSeconds = Math.abs(now / 1000 - sentAt);
  if (driftSeconds > TIMESTAMP_TOLERANCE_SECONDS) {
    return { ok: false, reason: `timestamp is ${Math.round(driftSeconds)}s away from now` };
  }

  const signed = `${id}.${timestamp}.${body}`;
  const expected = keysFor(secret).map((key) =>
    createHmac("sha256", key).update(signed).digest("base64")
  );

  // "v1,<base64>" repeated, space separated. Take the part after the comma.
  const provided = signatureHeader
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.includes(",") ? part.slice(part.indexOf(",") + 1) : part));

  for (const candidate of provided) {
    for (const valid of expected) {
      if (safeEqual(candidate, valid)) return { ok: true };
    }
  }

  return { ok: false, reason: "no signature matched" };
}

/** Both plausible readings of the shared secret. See verifyWhopSignature. */
function keysFor(secret: string): Buffer[] {
  const keys: Buffer[] = [Buffer.from(secret, "utf8")];

  const underscore = secret.indexOf("_");
  if (underscore !== -1) {
    const rest = secret.slice(underscore + 1);
    const decoded = Buffer.from(rest, "base64");
    // Only worth trying if it actually decoded to something.
    if (decoded.length > 0) keys.push(decoded);
  }

  return keys;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on a length mismatch, which is itself a non-match.
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

// ---------------------------------------------------------------------------
// Event interpretation
// ---------------------------------------------------------------------------

/** What an event means for entitlement. Null means "not our concern". */
export type Entitlement = boolean | null;

/**
 * Maps an event name to whether it grants or removes access.
 *
 * Both naming schemes are handled. The current API emits
 * `membership.activated` / `membership.deactivated`, while older integrations
 * and much of the community tooling still use `membership.went_valid` /
 * `membership.went_invalid` — accepting both means the endpoint works whichever
 * version the webhook is registered against.
 *
 * Everything unrecognised returns null and is acknowledged without action:
 * `payment.pending` and friends are real events that simply shouldn't move a
 * user between tiers.
 */
export function entitlementFor(eventType: string): Entitlement {
  const type = eventType.toLowerCase();

  const grants = [
    "membership.activated",
    "membership.went_valid",
    "membership_went_valid",
    "payment.succeeded",
    "payment_succeeded",
  ];

  const revokes = [
    "membership.deactivated",
    "membership.went_invalid",
    "membership_went_invalid",
    "membership.expired",
    "membership.cancelled",
    "membership.canceled",
    "refund.created",
    "payment.refunded",
  ];

  if (grants.includes(type)) return true;
  if (revokes.includes(type)) return false;
  return null;
}

// ---------------------------------------------------------------------------
// Identifying the buyer
// ---------------------------------------------------------------------------

const EMAIL_PATHS = [
  ["user", "email"],
  ["member", "email"],
  ["member", "user", "email"],
  ["membership", "user", "email"],
  ["email"],
  ["user_email"],
  ["customer", "email"],
  ["checkout_session", "email"],
];

/**
 * The email the customer paid with.
 *
 * Whop's payload shape differs between event families — a payment carries a
 * `user` object, a membership event carries the member — and the published
 * schemas don't pin every field down. So this checks the documented locations
 * first and, failing those, walks the object for any plausible `email` value.
 * The fallback is what keeps a schema tweak from silently costing someone the
 * upgrade they paid for.
 */
export function extractEmail(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  for (const path of EMAIL_PATHS) {
    const value = readPath(data as Record<string, unknown>, path);
    if (typeof value === "string" && value.includes("@")) return value.trim().toLowerCase();
  }

  return deepFindEmail(data, 0);
}

function readPath(source: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = source;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function deepFindEmail(value: unknown, depth: number): string | null {
  if (depth > 5 || !value || typeof value !== "object") return null;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (
      typeof child === "string" &&
      /email/i.test(key) &&
      child.includes("@") &&
      !/receipt|support|noreply/i.test(child)
    ) {
      return child.trim().toLowerCase();
    }
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = deepFindEmail(child, depth + 1);
    if (found) return found;
  }

  return null;
}

/** A short, non-sensitive description of the payload, for logs when matching fails. */
export function describeShape(data: unknown, depth = 0): string {
  if (data === null) return "null";
  if (Array.isArray(data)) return `[${data.length}]`;
  if (typeof data !== "object") return typeof data;
  if (depth > 1) return "{…}";

  return `{${Object.entries(data as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${describeShape(value, depth + 1)}`)
    .join(", ")}}`;
}
