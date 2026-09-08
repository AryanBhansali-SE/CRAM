#!/usr/bin/env node
/**
 * End-to-end check that the tier limits actually enforce.
 *
 *   npm run dev                     # in one terminal
 *   node scripts/test-limits.mjs    # in another
 *
 * What it does, per tier: creates a throwaway account, seeds its usage straight
 * into the database with the service role (so the boundary can be probed without
 * spending ten real Gemini calls), then drives the *HTTP routes* with that
 * user's session cookies — the same path a browser takes, so a pass means the
 * route refused, not just that some helper returned false.
 *
 * It also checks the two things that would make the whole scheme pointless: that
 * a user can't set their own is_paid flag, and can't delete their own usage rows
 * to win back questions.
 *
 * Everything it creates is deleted on the way out.
 */

import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// env + tiny test harness
// ---------------------------------------------------------------------------

function loadEnv(path = ".env.local") {
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const admin = {
  apikey: SERVICE,
  Authorization: `Bearer ${SERVICE}`,
  "Content-Type": "application/json",
};

let passed = 0;
let failed = 0;

function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ---------------------------------------------------------------------------
// supabase helpers
// ---------------------------------------------------------------------------

async function createUser(email) {
  await deleteUserByEmail(email);
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users`, {
    method: "POST",
    headers: admin,
    body: JSON.stringify({ email, password: "cram-test-password-123", email_confirm: true }),
  });
  if (!res.ok) throw new Error(`createUser ${email}: ${res.status} ${await res.text()}`);
  return res.json();
}

async function findUserByEmail(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=1000`, { headers: admin });
  const { users = [] } = await res.json();
  return users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
}

async function deleteUserByEmail(email) {
  const user = await findUserByEmail(email);
  if (!user) return;
  await fetch(`${URL_BASE}/auth/v1/admin/users/${user.id}`, { method: "DELETE", headers: admin });
}

/** Session cookies exactly as @supabase/ssr writes them — no format guesswork. */
async function cookieHeaderFor(email) {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "cram-test-password-123" }),
  });
  if (!res.ok) throw new Error(`sign in ${email}: ${res.status} ${await res.text()}`);
  const session = await res.json();

  const jar = new Map();
  const client = createServerClient(URL_BASE, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return {
    header: [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; "),
    accessToken: session.access_token,
  };
}

const rest = (path, options = {}) =>
  fetch(`${URL_BASE}/rest/v1/${path}`, { ...options, headers: { ...admin, ...options.headers } });

async function seedDocuments(userId, count) {
  const rows = Array.from({ length: count }, (_, i) => ({
    user_id: userId,
    filename: `seed-${i}.pdf`,
  }));
  const res = await rest("documents", { method: "POST", body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`seedDocuments: ${res.status} ${await res.text()}`);
}

async function seedQuestions(userId, count) {
  const rows = Array.from({ length: count }, () => ({ user_id: userId }));
  const res = await rest("question_events", { method: "POST", body: JSON.stringify(rows) });
  if (!res.ok) throw new Error(`seedQuestions: ${res.status} ${await res.text()}`);
}

async function setPaid(userId, isPaid) {
  const res = await rest(`profiles?id=eq.${userId}`, {
    method: "PATCH",
    body: JSON.stringify({ is_paid: isPaid }),
  });
  if (!res.ok) throw new Error(`setPaid: ${res.status} ${await res.text()}`);
}

// ---------------------------------------------------------------------------
// route drivers
// ---------------------------------------------------------------------------

const api = (path, cookie, options = {}) =>
  fetch(`${BASE}${path}`, {
    ...options,
    headers: { Cookie: cookie, ...(options.headers ?? {}) },
    redirect: "manual",
  });

async function getUsage(cookie) {
  const res = await api("/api/usage", cookie);
  return { status: res.status, body: await res.json() };
}

async function ask(cookie, question = "what is on the midterm?") {
  const res = await api("/api/query", cookie, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history: [] }),
  });
  return { status: res.status, body: await res.json() };
}

/**
 * A one-byte "PDF". The document-limit check runs before any parsing, so a real
 * PDF is only needed to get *past* the gate — which is exactly what makes this
 * useful: 403 means the limit refused it, 400 means the limit let it through and
 * the parser rejected it.
 */
async function upload(cookie) {
  const form = new FormData();
  form.append("files", new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46])]), "probe.pdf");
  const res = await api("/api/upload", cookie, { method: "POST", body: form });
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// tiers
// ---------------------------------------------------------------------------

const FREE_EMAIL = "cram-test-free@example.com";
const PAID_EMAIL = "cram-test-paid@example.com";

async function preflight() {
  const res = await rest("profiles?select=id&limit=1");
  if (res.status === 404 || res.status === 406) return false;
  return res.ok;
}

async function testFree() {
  console.log("\nFree tier (3 documents, 10 questions / 24h)");
  const user = await createUser(FREE_EMAIL);
  const { header: cookie, accessToken } = await cookieHeaderFor(FREE_EMAIL);

  const before = await getUsage(cookie);
  check("reports tier=free", before.body?.usage?.tier === "free", JSON.stringify(before.body));
  check("document limit is 3", before.body?.usage?.documents?.limit === 3);
  check("question limit is 10", before.body?.usage?.questions?.limit === 10);

  // --- questions ---
  await seedQuestions(user.id, 10);
  const spent = await ask(cookie);
  check("11th question refused with 403", spent.status === 403, `got ${spent.status}`);
  check("refusal carries question_limit", spent.body?.code === "question_limit");
  check("refusal carries usage snapshot", spent.body?.usage?.questions?.used === 10);

  // --- documents ---
  await seedDocuments(user.id, 3);
  const blocked = await upload(cookie);
  check("4th document refused with 403", blocked.status === 403, `got ${blocked.status}`);
  check("refusal carries document_limit", blocked.body?.code === "document_limit");

  // --- the two escalations that would break the model ---
  const selfUpgrade = await fetch(`${URL_BASE}/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ is_paid: true }),
  });
  const upgraded = selfUpgrade.ok ? await selfUpgrade.json() : [];
  check(
    "user cannot set their own is_paid",
    !selfUpgrade.ok || upgraded.length === 0,
    `status ${selfUpgrade.status}, rows ${upgraded.length}`
  );

  const selfReset = await fetch(`${URL_BASE}/rest/v1/question_events?user_id=eq.${user.id}`, {
    method: "DELETE",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${accessToken}`,
      Prefer: "return=representation",
    },
  });
  const deleted = selfReset.ok ? await selfReset.json() : [];
  check(
    "user cannot delete their usage to reset the count",
    !selfReset.ok || deleted.length === 0,
    `status ${selfReset.status}, rows ${deleted.length}`
  );

  await deleteUserByEmail(FREE_EMAIL);
}

async function testPaid() {
  console.log("\nPaid tier (unlimited)");
  const user = await createUser(PAID_EMAIL);
  await setPaid(user.id, true);
  const { header: cookie } = await cookieHeaderFor(PAID_EMAIL);

  // Well past every free ceiling.
  await seedQuestions(user.id, 40);
  await seedDocuments(user.id, 8);

  const usage = await getUsage(cookie);
  check("reports tier=paid", usage.body?.usage?.tier === "paid", JSON.stringify(usage.body));
  check("documents unlimited", usage.body?.usage?.documents?.limit === null);
  check("questions unlimited", usage.body?.usage?.questions?.limit === null);

  // Past the gate the probe file fails to parse — a 400, not a 403. That
  // distinction is the assertion: the limit didn't stop it.
  const past = await upload(cookie);
  check("upload passes the limit gate", past.status !== 403, `got ${past.status}`);

  await deleteUserByEmail(PAID_EMAIL);
}

async function testTrial() {
  console.log("\nTrial tier (1 document, 3 questions, lifetime)");
  const probe = await fetch(`${URL_BASE}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!probe.ok) {
    console.log(
      "  – skipped: anonymous sign-ins are disabled for this project.\n" +
        "    Enable Authentication → Providers → Anonymous sign-ins, then re-run."
    );
    return;
  }

  const session = await probe.json();
  const jar = new Map();
  const client = createServerClient(URL_BASE, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (list) => list.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await client.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  const cookie = [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
  const userId = session.user.id;

  const before = await getUsage(cookie);
  check("reports tier=trial", before.body?.usage?.tier === "trial", JSON.stringify(before.body));
  check("document limit is 1", before.body?.usage?.documents?.limit === 1);
  check("question limit is 3", before.body?.usage?.questions?.limit === 3);

  await seedQuestions(userId, 3);
  const spent = await ask(cookie);
  check("4th question refused with 403", spent.status === 403, `got ${spent.status}`);
  check("refusal carries question_limit", spent.body?.code === "question_limit");

  await seedDocuments(userId, 1);
  const blocked = await upload(cookie);
  check("2nd document refused with 403", blocked.status === 403, `got ${blocked.status}`);

  await fetch(`${URL_BASE}/auth/v1/admin/users/${userId}`, { method: "DELETE", headers: admin });
}

async function testSignedOut() {
  console.log("\nSigned out");
  const usage = await getUsage("");
  check("usage requires a session", usage.status === 401, `got ${usage.status}`);
  const asked = await ask("");
  check("query requires a session", asked.status === 401, `got ${asked.status}`);
  const uploaded = await upload("");
  check("upload requires a session", uploaded.status === 401, `got ${uploaded.status}`);
}

// ---------------------------------------------------------------------------

async function main() {
  const reachable = await fetch(BASE).then(
    () => true,
    () => false
  );
  if (!reachable) {
    console.error(`✗ ${BASE} isn't responding. Start the dev server first: npm run dev`);
    process.exit(1);
  }

  if (!(await preflight())) {
    console.error(
      "✗ public.profiles isn't there — apply supabase/migrations/0002_freemium.sql in the\n" +
        "  Supabase SQL editor first, otherwise limits run in degraded (unenforced) mode."
    );
    process.exit(1);
  }

  await testSignedOut();
  await testFree();
  await testPaid();
  await testTrial();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

await main();
