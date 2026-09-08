// Thin client-side wrappers around the API routes. Every call returns parsed
// JSON and throws a useful Error on failure, so components only handle UI state.
//
// Note there is no userId parameter anywhere: the routes read identity from the
// session cookie, so the browser has nothing to send and nothing to forge.

import type { CramDocument, ChatMessage, DocumentsResponse, QueryResponse, UploadResponse } from "./types";

/** Thrown when the session has expired so callers can bounce to login. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "UnauthorizedError";
  }
}

function messageFrom(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new UnauthorizedError();

  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Unexpected response from the server (${res.status}).`);
  }
}

export async function fetchDocuments(): Promise<CramDocument[]> {
  const res = await fetch("/api/documents");
  const data = await parseJson<DocumentsResponse>(res);
  if (!res.ok) throw new Error(data.error || "Couldn't load your documents.");
  return data.documents ?? [];
}

export async function uploadDocuments(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await parseJson<UploadResponse>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Upload failed.");
  return data;
}

export async function deleteDocument(documentId: string): Promise<void> {
  const res = await fetch(`/api/documents?documentId=${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
  const data = await parseJson<{ success?: boolean; error?: string }>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Couldn't remove that document.");
}

export async function askQuestion(
  question: string,
  history: ChatMessage[]
): Promise<QueryResponse> {
  const res = await fetch("/api/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, history }),
  });
  const data = await parseJson<QueryResponse>(res);
  if (!res.ok) throw new Error(data.error || "Couldn't get an answer.");
  return data;
}

export { messageFrom };
