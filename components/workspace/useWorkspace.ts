"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  askQuestion,
  deleteDocument,
  fetchDocuments,
  messageFrom,
  uploadDocuments,
  LimitError,
  ServiceError,
  UnauthorizedError,
} from "@/lib/api";
import { outOfDocuments, outOfQuestions } from "@/lib/tiers";
import { formatCount } from "@/lib/utils";
import type {
  CramDocument,
  LimitCode,
  QueryMode,
  ThreadMessage,
  UsageSnapshot,
} from "@/lib/types";

/** How many prior turns travel with each question so follow-ups resolve. */
const HISTORY_LIMIT = 6;

export type Notice = { tone: "info" | "success" | "error"; text: string } | null;

/** Which wall is up, and what triggered it. */
export type Wall = { code: LimitCode } | null;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * All workspace state in one place: documents, the chat thread, usage against
 * the plan, and the in-flight flags the UI needs. Components stay presentational.
 *
 * The limit checks here are for responsiveness only — they save a round trip and
 * keep the composer honest. Every one of them is also enforced in the API route,
 * which is what actually holds.
 */
export function useWorkspace() {
  const router = useRouter();

  const [documents, setDocuments] = useState<CramDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);

  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [input, setInput] = useState("");

  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [wall, setWall] = useState<Wall>(null);

  // Guards against setting state after the component unmounts mid-request.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * A 401 means the session lapsed (expired, or signed out in another tab).
   * Bounce to login rather than showing a confusing error in the sidebar.
   */
  const handleAuthError = useCallback(
    (err: unknown): boolean => {
      if (err instanceof UnauthorizedError) {
        router.replace(`/login?next=${encodeURIComponent("/workspace")}`);
        return true;
      }
      return false;
    },
    [router]
  );

  /**
   * A 403 on tier grounds isn't an error to report — it's a wall to raise. The
   * refusal carries fresh usage, so the meter corrects itself at the same time.
   */
  const handleLimitError = useCallback((err: unknown): boolean => {
    if (err instanceof LimitError) {
      if (alive.current) {
        setUsage(err.usage);
        setWall({ code: err.code });
      }
      return true;
    }
    return false;
  }, []);

  const closeWall = useCallback(() => setWall(null), []);
  const openWall = useCallback((code: LimitCode) => setWall({ code }), []);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const { documents: docs, usage: fresh } = await fetchDocuments();
      if (alive.current) {
        setDocuments(docs);
        if (fresh) setUsage(fresh);
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      if (alive.current) setDocsError(messageFrom(err));
    } finally {
      if (alive.current) setDocsLoading(false);
    }
  }, [handleAuthError]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const upload = useCallback(
    async (files: File[]) => {
      if (files.length === 0 || uploading) return;

      // Already at the cap: show the wall rather than uploading a file the
      // server is only going to refuse.
      if (outOfDocuments(usage)) {
        setWall({ code: "document_limit" });
        return;
      }

      setUploading(true);
      setNotice({ tone: "info", text: `Processing ${formatCount(files.length, "PDF")}…` });

      try {
        // Each file is its own request now, so a batch has real progress to
        // report rather than one long unexplained wait.
        const result = await uploadDocuments(files, (done, total) => {
          if (!alive.current || total <= 1 || done >= total) return;
          setNotice({ tone: "info", text: `Processing PDF ${done + 1} of ${total}…` });
        });
        const added = result.documents?.length ?? 0;
        const failures = result.failures ?? [];

        if (alive.current) {
          if (result.usage) setUsage(result.usage);
          setNotice(
            failures.length > 0
              ? {
                  tone: "error",
                  text: `Added ${formatCount(added, "document")}. Couldn't add ${failures
                    .map((f) => f.filename)
                    .join(", ")}.`,
                }
              : { tone: "success", text: `Added ${formatCount(added, "document")}.` }
          );
          // Part of the batch didn't fit the plan — say why, once the upload
          // that did fit has landed.
          if (result.limitReached) setWall({ code: "document_limit" });
        }
        await loadDocuments();
      } catch (err) {
        if (handleAuthError(err)) return;
        if (handleLimitError(err)) return;
        if (alive.current) setNotice({ tone: "error", text: messageFrom(err) });
      } finally {
        if (alive.current) setUploading(false);
      }
    },
    [handleAuthError, handleLimitError, loadDocuments, uploading, usage]
  );

  const remove = useCallback(
    async (doc: CramDocument) => {
      setRemovingId(doc.documentId);
      setNotice(null);
      try {
        const fresh = await deleteDocument(doc.documentId);
        if (alive.current) {
          setDocuments((prev) => prev.filter((d) => d.documentId !== doc.documentId));
          if (fresh) setUsage(fresh);
          setNotice({ tone: "success", text: `Removed ${doc.filename}.` });
        }
      } catch (err) {
        if (handleAuthError(err)) return;
        if (alive.current) setNotice({ tone: "error", text: messageFrom(err) });
      } finally {
        if (alive.current) setRemovingId(null);
      }
    },
    [handleAuthError]
  );

  const send = useCallback(
    async (raw?: string, options: { mode?: QueryMode; documentId?: string | null } = {}) => {
      const question = (raw ?? input).trim();
      if (!question || asking) return;

      const mode = options.mode ?? "ask";
      const documentId = options.documentId ?? null;

      // Out of questions: raise the wall and keep what they typed, rather than
      // sending a request that can only come back refused.
      if (outOfQuestions(usage)) {
        setInput(question);
        setWall({ code: "question_limit" });
        return;
      }

      // History is the thread as it stood *before* this question.
      const history = messages
        .filter((m) => !m.error)
        .slice(-HISTORY_LIMIT)
        .map((m) => ({ role: m.role, content: m.content }));

      const pendingId = newId();
      setMessages((prev) => [...prev, { id: pendingId, role: "user", content: question }]);
      setInput("");
      setAsking(true);

      try {
        const data = await askQuestion(question, history, { mode, documentId });
        if (alive.current) {
          if (data.usage) setUsage(data.usage);
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: "assistant",
              content: data.answer ?? "I couldn't produce an answer for that.",
              sources: data.sources,
              quiz: data.quiz,
              mode: data.mode ?? mode,
            },
          ]);
        }
      } catch (err) {
        if (handleAuthError(err)) return;

        // The question was never answered, so take it back out of the thread and
        // hand the text back to the composer instead of leaving a dead turn.
        if (err instanceof LimitError) {
          if (alive.current) {
            setMessages((prev) => prev.filter((m) => m.id !== pendingId));
            setInput(question);
          }
          handleLimitError(err);
          return;
        }

        if (alive.current) {
          // A rate limit or a brief outage is worth repeating verbatim, so the
          // turn carries what it needs to re-run itself.
          const retryable = err instanceof ServiceError && err.retryable;
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: "assistant",
              content:
                err instanceof ServiceError
                  ? err.message
                  : `Something went wrong: ${messageFrom(err)}`,
              error: true,
              retry: retryable ? { question, mode, documentId } : undefined,
            },
          ]);
        }
      } finally {
        if (alive.current) setAsking(false);
      }
    },
    [asking, handleAuthError, handleLimitError, input, messages, usage]
  );

  /**
   * The quick actions. Each one writes a normal-looking turn into the thread
   * ("Quiz me on Lecture 3.pdf") and then travels the same path as a typed
   * question — same limit check, same retrieval, same RLS.
   */
  const runAction = useCallback(
    (mode: QueryMode, documentId: string | null, concept?: string) => {
      const scope = documentId
        ? (documents.find((d) => d.documentId === documentId)?.filename ?? "that document")
        : "all my documents";

      const text =
        mode === "quiz"
          ? `Quiz me on ${scope}.`
          : mode === "summarize"
            ? `Summarise ${scope}.`
            : `Explain: ${(concept ?? "").trim()}`;

      return send(text, { mode, documentId });
    },
    [documents, send]
  );

  /** Re-runs a failed turn, dropping the error bubble it came from. */
  const retryMessage = useCallback(
    (message: ThreadMessage) => {
      if (!message.retry) return;
      setMessages((prev) => prev.filter((m) => m.id !== message.id));
      void send(message.retry.question, {
        mode: message.retry.mode,
        documentId: message.retry.documentId,
      });
    },
    [send]
  );

  const clearThread = useCallback(() => setMessages([]), []);

  return {
    documents,
    docsLoading,
    docsError,
    uploading,
    removingId,
    notice,
    setNotice,
    messages,
    asking,
    input,
    setInput,
    loadDocuments,
    upload,
    remove,
    send,
    runAction,
    retryMessage,
    clearThread,
    hasDocuments: documents.length > 0,
    usage,
    wall,
    openWall,
    closeWall,
    atDocumentLimit: outOfDocuments(usage),
    atQuestionLimit: outOfQuestions(usage),
  };
}
