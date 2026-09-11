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

/**
 * Largest single file worth sending. The platform rejects request bodies past
 * roughly 10MB (Vercel's serverless limit is lower still, 4.5MB), and that
 * rejection surfaces as an unhelpful "Failed to parse body as FormData" from
 * deep inside the runtime — so screen for it here and say something useful.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

function tooBigMessage(file: File): string {
  const mb = (file.size / 1048576).toFixed(1);
  return `${file.name} is ${mb}MB — the limit is ${MAX_FILE_BYTES / 1048576}MB per file.`;
}

/**
 * Uploads one file per request.
 *
 * Sending the whole batch as a single multipart body is what broke on large
 * selections: fifteen real PDFs comfortably exceed the request-body ceiling, and
 * the whole upload failed as one. One request per file keeps every body small
 * whatever the batch size, lets a single unreadable PDF fail on its own, and
 * gives the caller something to report progress against.
 *
 * Sequential rather than parallel, matching the server: each PDF already
 * parallelises its own embedding calls.
 */
export async function uploadDocuments(
  files: File[],
  onProgress?: (done: number, total: number) => void
): Promise<UploadResponse> {
  const documents: CramDocument[] = [];
  const failures: { filename: string; error: string }[] = [];
  let usage: UsageSnapshot | undefined;
  let limitHit: LimitError | null = null;

  for (const [index, file] of files.entries()) {
    onProgress?.(index, files.length);

    if (file.size > MAX_FILE_BYTES) {
      failures.push({ filename: file.name, error: tooBigMessage(file) });
      continue;
    }

    const formData = new FormData();
    formData.append("files", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await parseJson<UploadResponse>(res);

      if (!res.ok || !data.success) {
        failures.push({ filename: file.name, error: data.error || "Upload failed." });
        continue;
      }

      documents.push(...(data.documents ?? []));
      failures.push(...(data.failures ?? []));
      usage = data.usage ?? usage;
    } catch (err) {
      // Out of document slots: nothing later in the batch can succeed either, so
      // stop here and report the rest as skipped rather than firing doomed
      // requests at the server.
      if (err instanceof LimitError) {
        limitHit = err;
        usage = err.usage;
        for (const remaining of files.slice(index)) {
          failures.push({
            filename: remaining.name,
            error: "Skipped — that would go past your plan's document limit.",
          });
        }
        break;
      }
      if (err instanceof UnauthorizedError) throw err;
      failures.push({ filename: file.name, error: messageFrom(err) });
    }
  }

  onProgress?.(files.length, files.length);

  // Nothing landed and the plan was the reason — let the caller raise the wall
  // instead of showing a list of failures.
  if (documents.length === 0 && limitHit) throw limitHit;

  if (documents.length === 0) {
    throw new Error(failures.map((f) => `${f.filename}: ${f.error}`).join("; ") || "Upload failed.");
  }

  return { success: true, documents, failures, usage, limitReached: limitHit !== null };
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
