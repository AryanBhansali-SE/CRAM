// Shared types used by both the API routes and the client components.

export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  role: ChatRole;
  content: string;
};

/**
 * What the user asked for. Every mode retrieves from their own documents and
 * spends one question from their allowance — only the retrieval strategy and
 * the prompt differ.
 */
export type QueryMode = "ask" | "quiz" | "summarize" | "explain";

/** One practice question. The answer stays hidden until the user reveals it. */
export type QuizItem = {
  question: string;
  answer: string;
  /** "recall" is a fact to remember; "concept" asks them to reason. */
  kind: "recall" | "concept";
};

/** A message as rendered in the workspace thread. */
export type ThreadMessage = ChatMessage & {
  id: string;
  /** Filenames the answer drew on, shown as source chips. */
  sources?: string[];
  /** Set when the assistant turn failed, so the UI can style it as an error. */
  error?: boolean;
  /** Present on quiz turns — rendered as reveal cards rather than prose. */
  quiz?: QuizItem[];
  /** Which quick action produced this turn, for labelling. */
  mode?: QueryMode;
  /**
   * Set on an error turn the user can sensibly repeat (a rate limit, a brief
   * outage). Carries what to re-send so "Try again" doesn't need them to retype
   * anything — which matters for quiz and summarize, where they never typed.
   */
  retry?: { question: string; mode: QueryMode; documentId: string | null };
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
  /** Populated for mode "quiz". */
  quiz?: QuizItem[];
  mode?: QueryMode;
  error?: string;
  /** True when the failure is worth retrying (upstream rate limit or outage). */
  retryable?: boolean;
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
