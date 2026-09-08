#!/usr/bin/env node
/**
 * Flip a user between the free and paid tiers, until Whop billing is wired up.
 *
 *   node scripts/set-paid.mjs you@example.com          # -> paid
 *   node scripts/set-paid.mjs you@example.com false    # -> free
 *   node scripts/set-paid.mjs --list                   # who is paid right now
 *
 * Uses the service-role key from .env.local, which bypasses RLS — that is the
 * whole point: profiles.is_paid is deliberately not writable by the user it
 * belongs to, or anyone could grant themselves Pro.
 */

import { readFileSync } from "node:fs";

function loadEnv(path = ".env.local") {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    die(`Couldn't read ${path}. Run this from the repo root.`);
  }

  const env = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    // Values may carry stray whitespace or quotes; normalise both.
    env[trimmed.slice(0, eq).trim()] = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

function die(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const env = loadEnv();
const URL_BASE = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_BASE || !SERVICE_KEY) {
  die("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
}

const headers = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

async function listProfiles() {
  const res = await fetch(`${URL_BASE}/rest/v1/profiles?select=id,is_paid,created_at`, { headers });
  if (!res.ok) die(`Couldn't read profiles (${res.status}). Has migration 0002 been applied?`);
  return res.json();
}

async function findUserByEmail(email) {
  // The admin users endpoint pages; 1000 is plenty for a project this size.
  const res = await fetch(`${URL_BASE}/auth/v1/admin/users?per_page=1000`, { headers });
  if (!res.ok) die(`Couldn't list users (${res.status}).`);
  const { users = [] } = await res.json();
  return users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
}

const [target, flagArg] = process.argv.slice(2);

if (!target || target === "--help" || target === "-h") {
  console.log("Usage: node scripts/set-paid.mjs <email> [true|false]");
  console.log("       node scripts/set-paid.mjs --list");
  process.exit(target ? 0 : 1);
}

if (target === "--list") {
  const profiles = await listProfiles();
  const paid = profiles.filter((p) => p.is_paid);
  console.log(`${profiles.length} profile(s), ${paid.length} paid.`);
  for (const p of paid) console.log(`  paid: ${p.id}`);
  process.exit(0);
}

const isPaid = flagArg === undefined ? true : flagArg === "true";

const user = await findUserByEmail(target);
if (!user) die(`No account found for ${target}.`);

const res = await fetch(`${URL_BASE}/rest/v1/profiles?id=eq.${user.id}`, {
  method: "PATCH",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify({ is_paid: isPaid }),
});

if (!res.ok) {
  die(`Update failed (${res.status}): ${await res.text()}`);
}

const rows = await res.json();
if (rows.length === 0) {
  die(
    `No profile row for ${target}. The trigger in migration 0002 creates one on signup — has that migration been applied?`
  );
}

console.log(`✓ ${target} is now ${isPaid ? "PAID" : "FREE"} (${user.id})`);
