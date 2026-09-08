import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { embed, askLLM } from "@/lib/gemini";
import type { ChatMessage } from "@/lib/types";

type Match = { id: string; content: string; similarity: number };

type OwnedChunk = { id: string; documents: { filename: string; user_id: string } };

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// How many chunks we ask the vector index for before filtering down to the
// user's own documents, and how many survive into the prompt.
const CANDIDATE_COUNT = 30;
const CONTEXT_COUNT = 6;

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

    const body = await req.json();
    const question: string = body.question;
    const rawHistory: unknown[] = Array.isArray(body.history) ? body.history : [];

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

    // 1. Embed the latest question — retrieval is always driven by the new
    //    question, never by the conversation history. Follow-ups are first made
    //    self-contained so they still retrieve the right chunks.
    const retrievalQuery = await buildRetrievalQuery(question, history);
    const questionEmbedding = await embed(retrievalQuery);

    // 2. Retrieve candidate chunks from the DB. match_chunks searches the whole
    //    index, so we over-fetch and scope to this user's documents below.
    const { data, error } = await supabase.rpc("match_chunks", {
      query_embedding: questionEmbedding,
      match_count: CANDIDATE_COUNT,
    });

    if (error) throw error;

    // Blank chunks from older uploads still score ~0.46 and would otherwise
    // take slots from real content.
    const matches: Match[] = (data ?? []).filter(
      (m: Match) => typeof m.content === "string" && m.content.trim().length > 0
    );

    let chunks: { content: string; filename: string }[] = [];

    if (matches.length > 0) {
      // 3. match_chunks only returns (id, content, similarity), so join the ids
      //    back to their documents to get the owner and the file name.
      const { data: owned, error: ownerError } = await supabase
        .from("chunks")
        .select("id, documents!inner ( filename, user_id )")
        .in(
          "id",
          matches.map((m) => m.id)
        )
        .eq("documents.user_id", userId);

      if (ownerError) throw ownerError;

      const byId = new Map<string, string>(
        ((owned ?? []) as unknown as OwnedChunk[]).map((row) => [
          row.id,
          row.documents.filename,
        ])
      );

      // Keep match_chunks' similarity ordering, drop other users' chunks.
      const mine = matches.filter((m) => byId.has(m.id));
      const best = mine.length > 0 ? mine[0].similarity : 0;
      const floor = Math.max(MIN_SIMILARITY, best - RELEVANCE_BAND);

      chunks = mine
        .filter((m) => !Number.isFinite(m.similarity) || m.similarity >= floor)
        .slice(0, CONTEXT_COUNT)
        .map((m) => ({ content: m.content, filename: byId.get(m.id)! }));
    }

    if (chunks.length === 0) {
      return NextResponse.json({
        answer:
          "I couldn't find anything relevant in your materials. Try uploading a document first, or rephrasing the question.",
        sources: [],
      });
    }

    // 4. Build the prompt: retrieved context + recent conversation + question.
    const context = chunks
      .map((c, i) => `[${i + 1}] (from ${c.filename})\n${c.content}`)
      .join("\n\n");

    const historyBlock = history.length
      ? `\nCONVERSATION SO FAR (for resolving references like "that" or "the second point" — never treat it as a source of facts):
${formatHistory(history)}
`
      : "";

    const prompt = `You are Cram, a study assistant. Answer the student's question using ONLY the context from their uploaded materials below. The context may come from several different documents — combine them when the answer spans more than one. If the answer isn't in the context, say so honestly instead of guessing. Be clear and concise.

CONTEXT FROM THEIR MATERIALS:
${context}
${historyBlock}
STUDENT'S QUESTION: ${question}

ANSWER:`;

    // 5. Get the answer from the LLM.
    const answer = await askLLM(prompt);

    return NextResponse.json({
      answer,
      sourcesUsed: chunks.length,
      sources: [...new Set(chunks.map((c) => c.filename))],
      retrievalQuery,
    });
  } catch (err) {
    console.error("Query error:", err);
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
