// Thin client-side wrappers around the API routes. Every call returns parsed
// JSON and throws a useful Error on failure, so components only handle UI state.
//
// Note there is no userId parameter anywhere: the routes read identity from the
// session cookie, so the browser has nothing to send and nothing to forge.

import type {
  CramDocument,
  ChatMessage,
  DeleteDocumentResponse,
  DocumentsResponse,
  LimitCode,
  LimitPayload,
  QueryResponse,
  Tier,
  UploadResponse,
  UsageResponse,
  UsageSnapshot,
} from "./types";

/** Thrown when the session has expired so callers can bounce to login. */
export class UnauthorizedError extends Error {
  constructor() {
    super("Your session has expired. Please sign in again.");
    this.name = "UnauthorizedError";
  }
}

/**
 * Thrown when a route refused because the user's tier is spent. Carries the
 * usage snapshot so the UI can raise the right wall and update the meter in one
 * go, without a follow-up request.
 */
export class LimitError extends Error {
  readonly code: LimitCode;
  readonly tier: Tier;
  readonly usage: UsageSnapshot;

  constructor(payload: LimitPayload) {
    super(payload.error);
    this.name = "LimitError";
    this.code = payload.code;
    this.tier = payload.tier;
    this.usage = payload.usage;
  }
}

function isLimitPayload(data: unknown): data is LimitPayload {
  if (!data || typeof data !== "object") return false;
  const code = (data as LimitPayload).code;
  return code === "document_limit" || code === "question_limit";
}

function messageFrom(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function parseJson<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new UnauthorizedError();

  const text = await res.text();
  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new Error(`Unexpected response from the server (${res.status}).`);
  }

  // A refusal on tier grounds is not a generic failure — callers show a wall
  // for it rather than an error bubble.
  if (res.status === 403 && isLimitPayload(data)) throw new LimitError(data);

  return data;
}

export type DocumentsPayload = { documents: CramDocument[]; usage?: UsageSnapshot };

export async function fetchDocuments(): Promise<DocumentsPayload> {
  const res = await fetch("/api/documents");
  const data = await parseJson<DocumentsResponse>(res);
  if (!res.ok) throw new Error(data.error || "Couldn't load your documents.");
  return { documents: data.documents ?? [], usage: data.usage };
}

export async function fetchUsage(): Promise<UsageSnapshot | undefined> {
  const res = await fetch("/api/usage");
  const data = await parseJson<UsageResponse>(res);
  if (!res.ok) throw new Error(data.error || "Couldn't load your usage.");
  return data.usage;
}

export async function uploadDocuments(files: File[]): Promise<UploadResponse> {
  const formData = new FormData();
  for (const file of files) formData.append("files", file);

  const res = await fetch("/api/upload", { method: "POST", body: formData });
  const data = await parseJson<UploadResponse>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Upload failed.");
  return data;
}

export async function deleteDocument(documentId: string): Promise<UsageSnapshot | undefined> {
  const res = await fetch(`/api/documents?documentId=${encodeURIComponent(documentId)}`, {
    method: "DELETE",
  });
  const data = await parseJson<DeleteDocumentResponse>(res);
  if (!res.ok || !data.success) throw new Error(data.error || "Couldn't remove that document.");
  return data.usage;
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
