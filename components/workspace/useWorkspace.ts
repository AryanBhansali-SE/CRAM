"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  askQuestion,
  deleteDocument,
  fetchDocuments,
  messageFrom,
  uploadDocuments,
  UnauthorizedError,
} from "@/lib/api";
import { formatCount } from "@/lib/utils";
import type { CramDocument, ThreadMessage } from "@/lib/types";

/** How many prior turns travel with each question so follow-ups resolve. */
const HISTORY_LIMIT = 6;

export type Notice = { tone: "info" | "success" | "error"; text: string } | null;

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * All workspace state in one place: documents, the chat thread, and the
 * in-flight flags the UI needs. Components stay presentational.
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

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    setDocsError(null);
    try {
      const docs = await fetchDocuments();
      if (alive.current) setDocuments(docs);
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
      setUploading(true);
      setNotice({ tone: "info", text: `Processing ${formatCount(files.length, "PDF")}…` });

      try {
        const result = await uploadDocuments(files);
        const added = result.documents?.length ?? 0;
        const failures = result.failures ?? [];

        if (alive.current) {
          setNotice(
            failures.length > 0
              ? {
                  tone: "error",
                  text: `Added ${formatCount(added, "document")}. Couldn't read ${failures
                    .map((f) => f.filename)
                    .join(", ")}.`,
                }
              : { tone: "success", text: `Added ${formatCount(added, "document")}.` }
          );
        }
        await loadDocuments();
      } catch (err) {
        if (handleAuthError(err)) return;
        if (alive.current) setNotice({ tone: "error", text: messageFrom(err) });
      } finally {
        if (alive.current) setUploading(false);
      }
    },
    [handleAuthError, loadDocuments, uploading]
  );

  const remove = useCallback(
    async (doc: CramDocument) => {
      setRemovingId(doc.documentId);
      setNotice(null);
      try {
        await deleteDocument(doc.documentId);
        if (alive.current) {
          setDocuments((prev) => prev.filter((d) => d.documentId !== doc.documentId));
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
    async (raw?: string) => {
      const question = (raw ?? input).trim();
      if (!question || asking) return;

      // History is the thread as it stood *before* this question.
      const history = messages
        .filter((m) => !m.error)
        .slice(-HISTORY_LIMIT)
        .map((m) => ({ role: m.role, content: m.content }));

      setMessages((prev) => [...prev, { id: newId(), role: "user", content: question }]);
      setInput("");
      setAsking(true);

      try {
        const data = await askQuestion(question, history);
        if (alive.current) {
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: "assistant",
              content: data.answer ?? "I couldn't produce an answer for that.",
              sources: data.sources,
            },
          ]);
        }
      } catch (err) {
        if (handleAuthError(err)) return;
        if (alive.current) {
          setMessages((prev) => [
            ...prev,
            {
              id: newId(),
              role: "assistant",
              content: `Something went wrong: ${messageFrom(err)}`,
              error: true,
            },
          ]);
        }
      } finally {
        if (alive.current) setAsking(false);
      }
    },
    [asking, handleAuthError, input, messages]
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
    clearThread,
    hasDocuments: documents.length > 0,
  };
}
