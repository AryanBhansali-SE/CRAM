import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embed, askLLM } from "@/lib/gemini";
import {
  getUsage,
  limitPayload,
  questionsRemaining,
  recordQuestion,
  withQuestionSpent,
} from "@/lib/limits";
import {
  buildPrompt,
  contextSizeFor,
  parseQuiz,
  quizIntro,
  retrievalFor,
} from "@/lib/study-modes";
import { describeFailure } from "@/lib/errors";
import { hasEnv } from "@/lib/env";
import { withRetry } from "@/lib/retry";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, QueryMode } from "@/lib/types";

/**
 * Embedding plus two model calls can run well past a platform's default
 * function timeout. Vercel caps this at 60s on Hobby and 300s on Pro.
 */
export const maxDuration = 60;

type Match = { id: string; content: string; similarity: number };

type OwnedChunk = { id: string; documents: { filename: string; user_id: string } };

type CoverageRow = { content: string; document_id: string; documents: { filename: string } };

type Passage = { content: string; filename: string };

const MODES: QueryMode[] = ["ask", "quiz", "summarize", "explain"];

function readMode(value: unknown): QueryMode {
  return MODES.includes(value as QueryMode) ? (value as QueryMode) : "ask";
}

// How many chunks we ask the vector index for before filtering down to the
// user's own documents. How many survive into the prompt is per-mode.
const CANDIDATE_COUNT = 30;

/** Upper bound on rows pulled for coverage sampling before thinning them out. */
const COVERAGE_SCAN = 400;

// How many previous turns of the conversation get replayed to the model.
const HISTORY_LIMIT = 6;

/**
 * Retrieval always returns *something*, so without a floor an unrelated document
 * can land in the context and then get cited as a source. Rather than a fixed
 * cutoff (which depends on the corpus), keep only chunks close to the best match
 * — if everything is weakly matched the top hit still anchors the band, so a
 * genuine answer is never thrown away.
 */
const RELEVANCE_BAND = 0.15;
/** Below this, nothing in the corpus is plausibly about the question. */
const MIN_SIMILARITY = 0.35;

// A follow-up like "explain that more" embeds to nothing useful, so resolve it
// against the recent turns before retrieval. Retrieval is still driven purely by
// the latest question — this only makes that question self-contained.
async function buildRetrievalQuery(
  question: string,
  history: ChatMessage[]
): Promise<string> {
  if (history.length === 0) return question;

  const prompt = `Rewrite the student's latest question so it can be understood on its own, without the conversation.

Rules:
- Resolve references like "that", "it" or "the second point" into the thing they refer to.
- Keep it short and keep the student's wording wherever you can.
- If the question already stands on its own, return it unchanged.
- Output ONLY the rewritten question, nothing else.

CONVERSATION:
${formatHistory(history)}

LATEST QUESTION: ${question}

REWRITTEN QUESTION:`;

  try {
    const rewritten = (await askLLM(prompt)).trim();
    // Guard against a chatty or empty rewrite; fall back to the raw question.
    return rewritten && rewritten.length <= 500 ? rewritten : question;
  } catch (err) {
    console.error("Query rewrite failed, using raw question:", err);
    return question;
  }
}

function formatHistory(history: ChatMessage[]): string {
  return history
    .map((m) => `${m.role === "user" ? "Student" : "Assistant"}: ${m.content}`)
    .join("\n\n");
}

/**
 * Passages nearest the query vector — the right shape for a specific question.
 *
 * match_chunks is untouched: it still searches the index and RLS still scopes
 * its results, and the join below is what turns chunk ids into filenames.
 */
async function similarityPassages(
  supabase: SupabaseClient,
  userId: string,
  query: string,
  documentId: string | null,
  limit: number
): Promise<Passage[]> {
  const questionEmbedding = await withRetry(() => embed(query));

  const { data, error } = await supabase.rpc("match_chunks", {
    query_embedding: questionEmbedding,
    match_count: CANDIDATE_COUNT,
  });
  if (error) throw error;

  // Blank chunks from older uploads still score ~0.46 and would otherwise take
  // slots from real content.
  const matches: Match[] = (data ?? []).filter(
    (m: Match) => typeof m.content === "string" && m.content.trim().length > 0
  );
  if (matches.length === 0) return [];

  let owner = supabase
    .from("chunks")
    .select("id, documents!inner ( filename, user_id )")
    .in(
      "id",
      matches.map((m) => m.id)
    )
    .eq("documents.user_id", userId);

  if (documentId) owner = owner.eq("document_id", documentId);

  const { data: owned, error: ownerError } = await owner;
  if (ownerError) throw ownerError;

  const byId = new Map<string, string>(
    ((owned ?? []) as unknown as OwnedChunk[]).map((row) => [row.id, row.documents.filename])
  );

  // Keep match_chunks' similarity ordering, drop anything out of scope.
  const mine = matches.filter((m) => byId.has(m.id));
  const best = mine.length > 0 ? mine[0].similarity : 0;
  const floor = Math.max(MIN_SIMILARITY, best - RELEVANCE_BAND);

  return mine
    .filter((m) => !Number.isFinite(m.similarity) || m.similarity >= floor)
    .slice(0, limit)
    .map((m) => ({ content: m.content, filename: byId.get(m.id)! }));
}

/**
 * Passages spread across the material, for modes that are about a document as a
 * whole. Quizzing from the six chunks nearest some vector would test whichever
 * corner of the document happened to match; this samples the breadth instead.
 *
 * RLS already restricts `chunks` to the caller's own documents, so no user
 * filter is needed here — the inner join only supplies filenames.
 */
async function coveragePassages(
  supabase: SupabaseClient,
  documentId: string | null,
  limit: number
): Promise<Passage[]> {
  let query = supabase.from("chunks").select("content, document_id, documents!inner ( filename )");
  if (documentId) query = query.eq("document_id", documentId);

  const { data, error } = await query.limit(COVERAGE_SCAN);
  if (error) throw error;

  const rows = ((data ?? []) as unknown as CoverageRow[]).filter(
    (r) => typeof r.content === "string" && r.content.trim().length > 0
  );
  if (rows.length === 0) return [];

  const byDocument = new Map<string, CoverageRow[]>();
  for (const row of rows) {
    const list = byDocument.get(row.document_id) ?? [];
    list.push(row);
    byDocument.set(row.document_id, list);
  }

  // An even share per document, so one long upload can't crowd out the rest,
  // and an even stride within each so the sample isn't all front matter.
  const perDocument = Math.max(1, Math.floor(limit / byDocument.size));
  const picked: Passage[] = [];

  for (const list of byDocument.values()) {
    const take = Math.min(perDocument, list.length);
    const step = Math.max(1, Math.floor(list.length / take));
    for (let i = 0, taken = 0; i < list.length && taken < take; i += step, taken++) {
      picked.push({ content: list[i].content, filename: list[i].documents.filename });
    }
  }

  return picked.slice(0, limit);
}

export async function POST(req: NextRequest) {
  try {
    // Identity comes from the verified session, never from the request body —
    // a client-supplied id would let anyone read another user's documents.
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not signed in" }, { status: 401 });
    }
    const userId = user.id;

    // Refuse before spending an embedding or an LLM call. The composer also
    // disables itself when the allowance runs out, but this is the check that
    // actually holds: a direct POST to this route lands on exactly this line.
    const usage = await getUsage(supabase, user);
    if (questionsRemaining(usage) === 0) {
      return NextResponse.json(limitPayload("question_limit", usage), { status: 403 });
    }

    // Caught before anything is spent, so a misconfigured deployment doesn't
    // charge the user a question to tell them it's broken.
    if (!hasEnv("GOOGLE_API_KEY")) {
      console.error("GOOGLE_API_KEY is not set — answers are unavailable.");
      return NextResponse.json(
        { error: "Cram isn't fully configured on the server yet. This one's on us." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const question: string = body.question;
    const rawHistory: unknown[] = Array.isArray(body.history) ? body.history : [];
    const mode = readMode(body.mode);
    const documentId: string | null =
      typeof body.documentId === "string" && body.documentId.trim() ? body.documentId : null;

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    // Only keep the last few well-formed turns, and drop anything huge.
    const history: ChatMessage[] = rawHistory
      .filter(
        (m: unknown): m is ChatMessage =>
          !!m &&
          typeof m === "object" &&
          ((m as ChatMessage).role === "user" || (m as ChatMessage).role === "assistant") &&
          typeof (m as ChatMessage).content === "string" &&
          !!(m as ChatMessage).content.trim()
      )
      .slice(-HISTORY_LIMIT)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    // Scoping to one document is optional; when it's set, everything from the
    // retrieval to the wording of the prompt narrows to that file.
    let scopeLabel = "your materials";
    if (documentId) {
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .select("filename")
        .eq("id", documentId)
        .maybeSingle();

      if (docError) throw docError;
      if (!doc) {
        return NextResponse.json({ error: "That document isn't in your library." }, { status: 404 });
      }
      scopeLabel = doc.filename;
    }

    // 1. Retrieve. A specific question wants the nearest passages; a quiz or a
    //    summary wants breadth across the material.
    const limit = contextSizeFor(mode);
    let retrievalQuery = question;
    let passages: Passage[];

    if (retrievalFor(mode) === "coverage") {
      passages = await coveragePassages(supabase, documentId, limit);
    } else {
      // A follow-up like "explain that more" embeds to nothing useful, so
      // resolve it against the recent turns first.
      retrievalQuery = await buildRetrievalQuery(question, history);
      passages = await similarityPassages(supabase, userId, retrievalQuery, documentId, limit);
    }

    if (passages.length === 0) {
      // The similarity path already spent a rewrite and an embedding, so it
      // costs a question. The coverage path spent nothing, so it doesn't.
      if (retrievalFor(mode) === "similarity") {
        await recordQuestion(supabase, userId);
      }

      return NextResponse.json({
        mode,
        answer:
          retrievalFor(mode) === "similarity"
            ? "I couldn't find anything relevant in your materials. Try uploading a document first, or rephrasing the question."
            : `There's nothing in ${scopeLabel} to work from yet. Upload a PDF and try again.`,
        sources: [],
        usage:
          retrievalFor(mode) === "similarity" ? withQuestionSpent(usage) : usage,
      });
    }

    // 2. Build the prompt for this mode.
    const context = passages
      .map((p, i) => `[${i + 1}] (from ${p.filename})\n${p.content}`)
      .join("\n\n");

    // Only the conversational modes replay history; a quiz or summary is about
    // the documents, not the thread.
    const historyBlock =
      history.length && retrievalFor(mode) === "similarity"
        ? `\nCONVERSATION SO FAR (for resolving references like "that" or "the second point" — never treat it as a source of facts):
${formatHistory(history)}
`
        : "";

    const prompt = buildPrompt({ mode, context, question, historyBlock, scopeLabel });

    // 3. Ask the model. Nothing is recorded against the allowance until this
    //    succeeds, so a rate limit genuinely costs the user nothing.
    const raw = await withRetry(() => askLLM(prompt));
    await recordQuestion(supabase, userId);

    const sources = [...new Set(passages.map((p) => p.filename))];
    const spent = withQuestionSpent(usage);

    if (mode === "quiz") {
      const quiz = parseQuiz(raw);
      if (quiz) {
        return NextResponse.json({
          mode,
          quiz,
          answer: quizIntro(quiz.length, scopeLabel),
          sources,
          sourcesUsed: passages.length,
          usage: spent,
        });
      }
      // The model ignored the JSON instruction. Showing its reply as prose is a
      // better outcome than an error — the questions are usually still in there.
      console.warn("Quiz JSON parse failed; falling back to prose.");
    }

    return NextResponse.json({
      mode,
      answer: raw,
      sourcesUsed: passages.length,
      sources,
      retrievalQuery,
      usage: spent,
    });
  } catch (err) {
    console.error("Query error:", err);
    const failure = describeFailure(err);
    return NextResponse.json(
      { error: failure.message, retryable: failure.retryable },
      { status: failure.status }
    );
  }
}
