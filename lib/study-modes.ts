import "server-only";
import type { QueryMode, QuizItem } from "./types";

/**
 * Prompts for the study modes, and the parsing that turns a quiz back into
 * structured items.
 *
 * Every mode is grounded the same way: the model only ever sees passages
 * retrieved from the user's own uploads, and every prompt says so explicitly.
 * None of this changes how embeddings or retrieval work — only what is asked of
 * the model once the context is assembled.
 */

/** Retrieval strategy a mode needs. */
export type Retrieval = "similarity" | "coverage";

/**
 * "Quiz me" and "Summarize" are about the material as a whole, so picking the
 * six passages nearest some query vector is the wrong move — it would quiz the
 * student on whichever corner of the document happened to match. Those modes
 * sample across the documents instead. "Ask" and "Explain" are driven by
 * something specific the user said, so similarity is right for them.
 */
export function retrievalFor(mode: QueryMode): Retrieval {
  return mode === "quiz" || mode === "summarize" ? "coverage" : "similarity";
}

/** How many passages each mode puts in front of the model. */
export function contextSizeFor(mode: QueryMode): number {
  switch (mode) {
    case "quiz":
      return 14;
    case "summarize":
      return 16;
    default:
      return 6;
  }
}

const GROUNDING =
  "Use ONLY the passages below, which come from the student's own uploaded materials. " +
  "If something isn't in them, say so plainly rather than filling the gap from general knowledge.";

export function buildPrompt({
  mode,
  context,
  question,
  historyBlock,
  scopeLabel,
}: {
  mode: QueryMode;
  context: string;
  question: string;
  historyBlock: string;
  /** "your materials" or a single filename, for copy that reads naturally. */
  scopeLabel: string;
}): string {
  switch (mode) {
    case "quiz":
      return `You are Cram, a study assistant. Write practice questions from ${scopeLabel}.

${GROUNDING}

Rules:
- Between 5 and 8 questions.
- Mix two kinds: "recall" (a specific fact, definition or figure) and "concept" (asks the student to explain, compare, or apply an idea). Aim for roughly half of each.
- Every question must be answerable from the passages alone.
- Each answer should be 1-3 sentences, and should actually answer the question rather than pointing at where to look.
- Do not number the questions.

Return ONLY a JSON array, no prose and no code fence, shaped like:
[{"question": "...", "answer": "...", "kind": "recall"}]

PASSAGES:
${context}

JSON:`;

    case "summarize":
      return `You are Cram, a study assistant. Summarise ${scopeLabel} for a student revising it.

${GROUNDING}

Write:
- A one-sentence overview.
- Then "## Key points" with 4-8 bullets, each a specific claim, definition or result from the passages — not a description of what the document discusses.
- Then "## Worth memorising" with any figures, dates, formulae or definitions that look examinable. Omit this section if there are none.

Keep it tight and concrete. Prefer the material's own terms.
${historyBlock}
PASSAGES:
${context}

SUMMARY:`;

    case "explain":
      return `You are Cram, a study assistant. Explain this concept in plain language: ${question}

${GROUNDING}

Write for a student meeting it for the first time:
- Start with a two-sentence plain-English answer, no jargon.
- Then unpack it, introducing the material's own terminology as you go.
- Use a concrete example from the passages if one is there.
- If the passages only partly cover it, explain what they do cover and say what's missing.
${historyBlock}
PASSAGES:
${context}

EXPLANATION:`;

    default:
      return `You are Cram, a study assistant. Answer the student's question using ONLY the context from their uploaded materials below. The context may come from several different documents — combine them when the answer spans more than one. If the answer isn't in the context, say so honestly instead of guessing. Be clear and concise.

CONTEXT FROM THEIR MATERIALS:
${context}
${historyBlock}
STUDENT'S QUESTION: ${question}

ANSWER:`;
  }
}

/**
 * Pulls the quiz array out of the model's reply.
 *
 * Models wrap JSON in code fences or a sentence of preamble often enough that
 * parsing the raw string fails regularly, so fall back to the outermost bracket
 * pair before giving up. Returns null when nothing usable comes back, and the
 * caller degrades to showing the reply as ordinary prose.
 */
export function parseQuiz(raw: string): QuizItem[] | null {
  const candidates: string[] = [];

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) candidates.push(fenced[1]);

  const first = raw.indexOf("[");
  const last = raw.lastIndexOf("]");
  if (first !== -1 && last > first) candidates.push(raw.slice(first, last + 1));

  candidates.push(raw);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate.trim());
      if (!Array.isArray(parsed)) continue;

      const items = parsed
        .filter(
          (item): item is { question: string; answer: string; kind?: string } =>
            !!item &&
            typeof item === "object" &&
            typeof item.question === "string" &&
            typeof item.answer === "string" &&
            item.question.trim().length > 0 &&
            item.answer.trim().length > 0
        )
        .map((item) => ({
          question: item.question.trim(),
          answer: item.answer.trim(),
          kind: item.kind === "concept" ? ("concept" as const) : ("recall" as const),
        }));

      if (items.length > 0) return items;
    } catch {
      // Try the next candidate.
    }
  }

  return null;
}

/** The line shown above a quiz, in place of an answer. */
export function quizIntro(count: number, scopeLabel: string): string {
  return `${count} practice question${count === 1 ? "" : "s"} from ${scopeLabel}. Try each one before revealing the answer.`;
}
