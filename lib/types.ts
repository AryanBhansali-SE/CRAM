// Shared types used by both the API routes and the client components.

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/** A message as rendered in the workspace thread. */
export type ThreadMessage = ChatMessage & {
  id: string;
  /** Filenames the answer drew on, shown as source chips. */
  sources?: string[];
  /** Set when the assistant turn failed, so the UI can style it as an error. */
  error?: boolean;
};

export type CramDocument = {
  documentId: string;
  filename: string;
  chunks: number;
  createdAt?: string;
};

export type UploadFailure = {
  filename: string;
  error: string;
};

export type UploadResponse = {
  success?: boolean;
  documents?: CramDocument[];
  failures?: UploadFailure[];
  error?: string;
};

export type QueryResponse = {
  answer?: string;
  sources?: string[];
  sourcesUsed?: number;
  retrievalQuery?: string;
  error?: string;
};

export type DocumentsResponse = {
  documents?: CramDocument[];
  error?: string;
};
