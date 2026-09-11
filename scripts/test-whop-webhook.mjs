#!/usr/bin/env node
/**
 * End-to-end check of the Whop webhook.
 *
 *   WHOP_WEBHOOK_SECRET=ws_test... npm run dev     # in one terminal
 *   node scripts/test-whop-webhook.mjs             # in another
 *
 * Signature verification is the entire security boundary for this endpoint —
 * it's the only thing standing between a stranger and a free Pro account — so
 * most of this suite is adversarial: forged signatures, replayed timestamps,
 * tampered bodies, missing headers.
 *
 * The rest drives a real upgrade and downgrade against a throwaway account and
 * confirms the is_paid column actually moved.
 */

import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ENDPOINT = `${BASE}/api/webhooks/whop`;

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}

const SECRET = process.env.WHOP_WEBHOOK_SECRET ?? env.WHOP_WEBHOOK_SECRET;
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const S = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = { apikey: S, Authorization: `Bearer ${S}`, "Content-Type": "application/json" };

if (!SECRET) {
  console.error(
    "✗ WHOP_WEBHOOK_SECRET isn't set. Add it to .env.local (any ws_... value works for\n" +
      "  testing, as long as the dev server was started with the same one) and retry."
  );
  process.exit(1);
}

const EMAIL = "cram-whop-test@example.com";
const PASS = "cram-test-password-123";

let pass = 0;
let fail = 0;
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

/** Signs exactly the way Whop does: HMAC-SHA256 over id.timestamp.body. */
function sign(body, { id = "msg_test_1", timestamp = Math.floor(Date.now() / 1000), key = SECRET } = {}) {
  const signature = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64");
  return {
    "webhook-id": id,
    "webhook-timestamp": String(timestamp),
    "webhook-signature": `v1,${signature}`,
    "content-type": "application/json",
  };
}

function post(body, headers) {
  return fetch(ENDPOINT, { method: "POST", headers, body });
}

function paymentEvent(type, email) {
  return JSON.stringify({
    id: "msg_" + Math.random().toString(36).slice(2),
    type,
    api_version: "v1",
    timestamp: new Date().toISOString(),
    account_id: "biz_test",
    data: {
      id: "pay_test",
      status: "succeeded",
      currency: "usd",
      user: { id: "user_test", name: "Test", username: "test", email },
      membership: { id: "mem_test", status: "active" },
    },
  });
}

async function findUser() {
  const r = await fetch(`${U}/auth/v1/admin/users?per_page=1000`, { headers: admin });
  const { users = [] } = await r.json();
  return users.find((x) => (x.email ?? "").toLowerCase() === EMAIL);
}
async function delUser() {
  const u = await findUser();
  if (u) await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: admin });
}
async function isPaid(userId) {
  const r = await fetch(`${U}/rest/v1/profiles?id=eq.${userId}&select=is_paid`, { headers: admin });
  const rows = await r.json();
  return rows[0]?.is_paid ?? null;
}

async function main() {
  const reachable = await fetch(BASE).then(
    () => true,
    () => false
  );
  if (!reachable) {
    console.error(`✗ ${BASE} isn't responding. Start the dev server first: npm run dev`);
    process.exit(1);
  }

  console.log("\nForged and malformed requests are refused");

  const body = paymentEvent("payment.succeeded", EMAIL);

  const unsigned = await post(body, { "content-type": "application/json" });
  check("no signature headers -> 401", unsigned.status === 401, `got ${unsigned.status}`);

  const wrongKey = await post(body, sign(body, { key: "ws_not_the_real_secret" }));
  check("signature from the wrong secret -> 401", wrongKey.status === 401, `got ${wrongKey.status}`);

  const tampered = await post(paymentEvent("payment.succeeded", "attacker@example.com"), sign(body));
  check("body altered after signing -> 401", tampered.status === 401, `got ${tampered.status}`);

  const stale = await post(body, sign(body, { timestamp: Math.floor(Date.now() / 1000) - 3600 }));
  check("replayed hour-old timestamp -> 401", stale.status === 401, `got ${stale.status}`);

  const futured = await post(body, sign(body, { timestamp: Math.floor(Date.now() / 1000) + 3600 }));
  check("timestamp an hour in the future -> 401", futured.status === 401, `got ${futured.status}`);

  const swappedId = await post(body, {
    ...sign(body),
    "webhook-id": "msg_different_id",
  });
  check("webhook-id changed after signing -> 401", swappedId.status === 401, `got ${swappedId.status}`);

  console.log("\nGenuine requests are accepted");

  await delUser();
  const user = await (
    await fetch(`${U}/auth/v1/admin/users`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify({ email: EMAIL, password: PASS, email_confirm: true }),
    })
  ).json();

  check("test account starts unpaid", (await isPaid(user.id)) === null);

  const upgrade = await post(body, sign(body));
  const upgradeBody = await upgrade.json();
  check("payment.succeeded accepted", upgrade.status === 200, `got ${upgrade.status}`);
  check("reports an upgrade", upgradeBody.action === "upgraded", JSON.stringify(upgradeBody));
  check("is_paid is now true", (await isPaid(user.id)) === true);

  const cancelBody = paymentEvent("membership.deactivated", EMAIL);
  const downgrade = await post(cancelBody, sign(cancelBody));
  const downgradeBody = await downgrade.json();
  check("membership.deactivated accepted", downgrade.status === 200, `got ${downgrade.status}`);
  check("reports a downgrade", downgradeBody.action === "downgraded", JSON.stringify(downgradeBody));
  check("is_paid is now false", (await isPaid(user.id)) === false);

  // The legacy event name should work identically.
  const legacyBody = paymentEvent("membership.went_valid", EMAIL);
  const legacy = await post(legacyBody, sign(legacyBody));
  check("legacy membership.went_valid also upgrades", (await legacy.json()).action === "upgraded");

  console.log("\nEdge cases are handled without crashing");

  const unknownBody = paymentEvent("payment.pending", EMAIL);
  const unknown = await post(unknownBody, sign(unknownBody));
  const unknownJson = await unknown.json();
  check("irrelevant event acknowledged, not retried", unknown.status === 200 && unknownJson.action === "ignored");

  const strangerBody = paymentEvent("payment.succeeded", "nobody-here@example.com");
  const stranger = await post(strangerBody, sign(strangerBody));
  const strangerJson = await stranger.json();
  check(
    "payment from an unknown email is logged, not fatal",
    stranger.status === 200 && strangerJson.action === "no_matching_user",
    JSON.stringify(strangerJson)
  );

  const noEmail = JSON.stringify({ type: "payment.succeeded", data: { id: "pay_x" } });
  const noEmailRes = await post(noEmail, sign(noEmail));
  const noEmailJson = await noEmailRes.json();
  check(
    "payload with no email is logged, not fatal",
    noEmailRes.status === 200 && noEmailJson.action === "no_email_in_payload",
    JSON.stringify(noEmailJson)
  );

  const garbage = "not json at all";
  const garbageRes = await post(garbage, sign(garbage));
  check("signed but unparseable body -> 400", garbageRes.status === 400, `got ${garbageRes.status}`);

  await delUser();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

await main();
