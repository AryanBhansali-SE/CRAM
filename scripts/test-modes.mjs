#!/usr/bin/env node
/**
 * End-to-end check of the study modes (quiz / summarize / explain).
 *
 *   npm run dev                            # in one terminal
 *   node scripts/test-modes.mjs            # in another
 *
 * Uploads a real PDF through the real route so the chunks carry real
 * embeddings, then drives each mode over HTTP and checks the shape of what
 * comes back — including that every mode spends exactly one question from the
 * caller's allowance, and that the limit refuses them like any other question.
 *
 * Everything it creates is deleted on the way out.
 */

import { readFileSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// A minimal but genuinely valid PDF, built here so the suite needs no fixture
// file and no platform tooling. Byte offsets in the xref table are computed
// from the assembled body, which is what makes pdf2json accept it.
// ---------------------------------------------------------------------------
function buildPdf(paragraphs) {
  const lines = paragraphs
    .map((text, i) => `BT /F1 11 Tf 54 ${720 - i * 22} Td (${text.replace(/[()\\]/g, "\\$&")}) Tj ET`)
    .join("\n");

  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>",
    `<</Length ${lines.length}>>\nstream\n${lines}\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });

  const startxref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${startxref}\n%%EOF`;

  return Buffer.from(pdf, "latin1");
}

const BIOLOGY = buildPdf([
  "BIOL 210 Study Guide - Cellular Respiration",
  "Cellular respiration converts glucose into ATP, the energy currency of the cell.",
  "Glycolysis takes place in the cytoplasm and yields a net of two ATP per glucose.",
  "The Krebs cycle occurs in the mitochondrial matrix and produces NADH and FADH2.",
  "Oxidative phosphorylation happens at the inner mitochondrial membrane.",
  "The electron transport chain generates roughly 34 ATP per glucose molecule.",
  "Fermentation is the anaerobic pathway and yields only two ATP per glucose.",
  "The midterm covers lectures one through seven and is weighted at thirty percent.",
]);

// ---------------------------------------------------------------------------

const env = {};
for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const eq = t.indexOf("=");
  if (eq === -1) continue;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
}
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const S = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = { apikey: S, Authorization: `Bearer ${S}`, "Content-Type": "application/json" };
const EMAIL = "cram-modes-test@example.com";
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

async function findUser() {
  const r = await fetch(`${U}/auth/v1/admin/users?per_page=1000`, { headers: admin });
  const { users = [] } = await r.json();
  return users.find((x) => (x.email ?? "").toLowerCase() === EMAIL);
}
async function delUser() {
  const u = await findUser();
  if (u) await fetch(`${U}/auth/v1/admin/users/${u.id}`, { method: "DELETE", headers: admin });
}

async function session() {
  const tok = await fetch(`${U}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  });
  const s = await tok.json();
  const jar = new Map();
  const client = createServerClient(U, ANON, {
    cookies: {
      getAll: () => [...jar.entries()].map(([name, value]) => ({ name, value })),
      setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  await client.auth.setSession({ access_token: s.access_token, refresh_token: s.refresh_token });
  return [...jar.entries()].map(([n, v]) => `${n}=${encodeURIComponent(v)}`).join("; ");
}

function ask(cookie, body) {
  return fetch(`${BASE}/api/query`, {
    method: "POST",
    headers: { Cookie: cookie, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

  await delUser();
  const user = await (
    await fetch(`${U}/auth/v1/admin/users`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify({ email: EMAIL, password: PASS, email_confirm: true }),
    })
  ).json();

  // Paid for the shape tests, so the free allowance doesn't interrupt them.
  await fetch(`${U}/rest/v1/profiles`, {
    method: "POST",
    headers: { ...admin, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify({ id: user.id, is_paid: true }),
  });

  const cookie = await session();

  console.log("\nUpload a real PDF (embeddings are generated for real)");
  const form = new FormData();
  form.append("files", new Blob([BIOLOGY], { type: "application/pdf" }), "biol-210.pdf");
  const up = await fetch(`${BASE}/api/upload`, {
    method: "POST",
    headers: { Cookie: cookie },
    body: form,
  });
  const upBody = await up.json();
  check("PDF ingested", up.ok && upBody.success === true, JSON.stringify(upBody).slice(0, 200));
  const documentId = upBody.documents?.[0]?.documentId;
  check("chunks were produced", (upBody.documents?.[0]?.chunks ?? 0) > 0);

  if (!documentId) {
    console.log("\nCannot continue without an ingested document.");
    await delUser();
    process.exit(1);
  }

  console.log("\nQuiz me");
  const quizRes = await ask(cookie, { question: "Quiz me on my materials.", mode: "quiz" });
  const quiz = await quizRes.json();
  check("returns 200", quizRes.ok, `got ${quizRes.status}`);
  check("mode echoed as quiz", quiz.mode === "quiz");
  check("quiz items returned", Array.isArray(quiz.quiz) && quiz.quiz.length >= 3, `${quiz.quiz?.length} items`);
  check(
    "every item has a question and an answer",
    (quiz.quiz ?? []).every((q) => q.question?.length > 0 && q.answer?.length > 0)
  );
  check(
    "kinds are recall/concept",
    (quiz.quiz ?? []).every((q) => q.kind === "recall" || q.kind === "concept")
  );
  check("cites a source", (quiz.sources ?? []).includes("biol-210.pdf"));

  console.log("\nSummarize");
  const sumRes = await ask(cookie, { question: "Summarise my materials.", mode: "summarize" });
  const sum = await sumRes.json();
  check("returns 200", sumRes.ok, `got ${sumRes.status}`);
  check("has key points section", /key points/i.test(sum.answer ?? ""), (sum.answer ?? "").slice(0, 120));
  check("grounded in the document", /ATP|glycolysis|respiration/i.test(sum.answer ?? ""));

  console.log("\nExplain");
  const expRes = await ask(cookie, { question: "glycolysis", mode: "explain" });
  const exp = await expRes.json();
  check("returns 200", expRes.ok, `got ${expRes.status}`);
  check("explains the named concept", /glycolysis/i.test(exp.answer ?? ""), (exp.answer ?? "").slice(0, 120));

  console.log("\nDocument scoping");
  const scoped = await ask(cookie, {
    question: "Summarise this document.",
    mode: "summarize",
    documentId,
  });
  const scopedBody = await scoped.json();
  check("scoped request succeeds", scoped.ok, `got ${scoped.status}`);
  check("sources limited to the scoped document", (scopedBody.sources ?? []).every((s) => s === "biol-210.pdf"));

  const bogus = await ask(cookie, {
    question: "Summarise this.",
    mode: "summarize",
    documentId: "00000000-0000-0000-0000-000000000000",
  });
  check("unknown document is refused", bogus.status === 404, `got ${bogus.status}`);

  console.log("\nEvery mode spends exactly one question");
  // Drop to the free tier and count.
  await fetch(`${U}/rest/v1/profiles?id=eq.${user.id}`, {
    method: "PATCH",
    headers: admin,
    body: JSON.stringify({ is_paid: false }),
  });
  await fetch(`${U}/rest/v1/question_events?user_id=eq.${user.id}`, {
    method: "DELETE",
    headers: admin,
  });

  const before = await (await fetch(`${BASE}/api/usage`, { headers: { Cookie: cookie } })).json();
  check("starts at zero", before.usage?.questions?.used === 0, JSON.stringify(before.usage?.questions));

  await ask(cookie, { question: "Quiz me.", mode: "quiz" });
  await ask(cookie, { question: "Summarise.", mode: "summarize" });
  await ask(cookie, { question: "ATP", mode: "explain" });

  const after = await (await fetch(`${BASE}/api/usage`, { headers: { Cookie: cookie } })).json();
  check(
    "three modes cost three questions",
    after.usage?.questions?.used === 3,
    `used=${after.usage?.questions?.used}`
  );

  console.log("\nModes obey the question limit");
  // Seed up to exactly the limit from whatever has actually been used, rather
  // than assuming the count above — an upstream hiccup makes that assumption
  // wrong and turns one failure into three.
  const used = after.usage?.questions?.used ?? 0;
  const limit = after.usage?.questions?.limit ?? 10;
  const topUp = Math.max(0, limit - used);
  if (topUp > 0) {
    await fetch(`${U}/rest/v1/question_events`, {
      method: "POST",
      headers: admin,
      body: JSON.stringify(Array.from({ length: topUp }, () => ({ user_id: user.id }))),
    });
  }
  const walled = await ask(cookie, { question: "Quiz me.", mode: "quiz" });
  const walledBody = await walled.json();
  check("quiz refused at the limit", walled.status === 403, `got ${walled.status}`);
  check("refusal is a question_limit", walledBody.code === "question_limit");

  await delUser();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

await main();
