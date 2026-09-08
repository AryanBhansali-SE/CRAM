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
  usage?: UsageSnapshot;
  /** Part of the batch was turned away by the plan's document limit. */
  limitReached?: boolean;
  error?: string;
};

export type QueryResponse = {
  answer?: string;
  sources?: string[];
  sourcesUsed?: number;
  retrievalQuery?: string;
  usage?: UsageSnapshot;
  error?: string;
};

export type DocumentsResponse = {
  documents?: CramDocument[];
  usage?: UsageSnapshot;
  error?: string;
};

export type DeleteDocumentResponse = {
  success?: boolean;
  documentId?: string;
  usage?: UsageSnapshot;
  error?: string;
};

// ---------------------------------------------------------------------------
// Freemium tiers
// ---------------------------------------------------------------------------

/**
 * "trial" is an anonymous visitor (a real Supabase user with is_anonymous set,
 * so RLS still applies to them). "free" is a signed-up account, "paid" one with
 * profiles.is_paid.
 */
export type Tier = "trial" | "free" | "paid";

/** How a question allowance is scoped. "none" means unlimited. */
export type QuestionWindow = "lifetime" | "day" | "none";

/** A `limit` of null means unlimited. */
export type UsageSnapshot = {
  tier: Tier;
  documents: { used: number; limit: number | null };
  questions: {
    used: number;
    limit: number | null;
    window: QuestionWindow;
    /** When the oldest question in the window ages out. Null if nothing to reset. */
    resetsAt: string | null;
  };
  /**
   * True when the usage tables aren't reachable (migration 0002 not applied
   * yet). Limits can't be enforced in that state, so the UI hides the meter
   * rather than showing numbers that mean nothing.
   */
  degraded?: boolean;
};

export type LimitCode = "document_limit" | "question_limit";

/** Body of a 403 from a route that refused because a tier limit was reached. */
export type LimitPayload = {
  error: string;
  code: LimitCode;
  tier: Tier;
  usage: UsageSnapshot;
};

export type UsageResponse = { usage?: UsageSnapshot; error?: string };
