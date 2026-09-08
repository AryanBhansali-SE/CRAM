import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { LimitCode, LimitPayload, QuestionWindow, Tier, UsageSnapshot } from "./types";

/**
 * Tier limits and the usage queries behind them.
 *
 * This module is the only place limits are defined. The API routes enforce
 * against it; the UI only ever *displays* what a route reports, so a client
 * that lies about its usage still gets refused server-side.
 */

/**
 * Daily allowances are a rolling window rather than a calendar day. A calendar
 * reset needs a timezone to be meaningful — the server's, the user's, or UTC —
 * and all three are wrong for somebody. "Ten questions per any 24 hours" needs
 * no timezone, no cron, and no stored counter to reset.
 */
export const QUESTION_WINDOW_HOURS = 24;

type TierPolicy = {
  documents: number | null;
  questions: number | null;
  window: QuestionWindow;
};

export const TIER_LIMITS: Record<Tier, TierPolicy> = {
  // Anonymous preview: enough to see the product work, not enough to live on.
  trial: { documents: 1, questions: 3, window: "lifetime" },
  free: { documents: 3, questions: 10, window: "day" },
  paid: { documents: null, questions: null, window: "none" },
};

/** PostgREST codes for "that table isn't there" — i.e. migration 0002 is unapplied. */
const MISSING_TABLE_CODES = new Set(["42P01", "PGRST205", "PGRST106"]);

function isMissingTable(error: { code?: string } | null): boolean {
  return !!error?.code && MISSING_TABLE_CODES.has(error.code);
}

/**
 * An anonymous Supabase user is a real row in auth.users with a real uid, so
 * every RLS policy applies to them unchanged — they just can't sign in twice.
 */
export function isAnonymous(user: User): boolean {
  return user.is_anonymous === true;
}

export function tierFor(user: User, isPaid: boolean): Tier {
  if (isAnonymous(user)) return "trial";
  return isPaid ? "paid" : "free";
}

/** Everything unlimited, used when the usage tables aren't reachable. */
function degradedSnapshot(tier: Tier, documentsUsed: number): UsageSnapshot {
  return {
    tier,
    documents: { used: documentsUsed, limit: null },
    questions: { used: 0, limit: null, window: "none", resetsAt: null },
    degraded: true,
  };
}

/**
 * Reads the user's tier and current consumption in three small queries.
 *
 * Never throws for a missing table: if migration 0002 hasn't been run the app
 * keeps working with limits disabled rather than 500ing on every request.
 */
export async function getUsage(supabase: SupabaseClient, user: User): Promise<UsageSnapshot> {
  // documents.user_id is TEXT (it predates auth), so compare against the string.
  const { count: documentsUsed } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const documents = documentsUsed ?? 0;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("is_paid")
    .eq("id", user.id)
    .maybeSingle();

  if (isMissingTable(profileError)) {
    console.warn(
      "[limits] public.profiles is missing — run supabase/migrations/0002_freemium.sql. Limits are NOT being enforced."
    );
    return degradedSnapshot(isAnonymous(user) ? "trial" : "free", documents);
  }

  const tier = tierFor(user, profile?.is_paid === true);
  const policy = TIER_LIMITS[tier];

  if (policy.window === "none") {
    return {
      tier,
      documents: { used: documents, limit: policy.documents },
      questions: { used: 0, limit: null, window: "none", resetsAt: null },
    };
  }

  const since =
    policy.window === "day"
      ? new Date(Date.now() - QUESTION_WINDOW_HOURS * 3600_000).toISOString()
      : null;

  // One round trip for both the count and the oldest event: the count comes
  // from the header, the row from the body, so resetsAt costs nothing extra.
  let query = supabase
    .from("question_events")
    .select("created_at", { count: "exact" })
    .eq("user_id", user.id);
  if (since) query = query.gte("created_at", since);

  const {
    data: oldest,
    count: questionsUsed,
    error: eventsError,
  } = await query.order("created_at", { ascending: true }).limit(1);

  if (isMissingTable(eventsError)) {
    console.warn(
      "[limits] public.question_events is missing — run supabase/migrations/0002_freemium.sql. Limits are NOT being enforced."
    );
    return degradedSnapshot(tier, documents);
  }

  const oldestAt = oldest?.[0]?.created_at as string | undefined;

  return {
    tier,
    documents: { used: documents, limit: policy.documents },
    questions: {
      used: questionsUsed ?? 0,
      limit: policy.questions,
      window: policy.window,
      resetsAt:
        policy.window === "day" && oldestAt
          ? new Date(new Date(oldestAt).getTime() + QUESTION_WINDOW_HOURS * 3600_000).toISOString()
          : null,
    },
  };
}

/** How many more documents this user may add. Null means unlimited. */
export function documentsRemaining(usage: UsageSnapshot): number | null {
  if (usage.documents.limit === null) return null;
  return Math.max(0, usage.documents.limit - usage.documents.used);
}

/** How many more questions this user may ask. Null means unlimited. */
export function questionsRemaining(usage: UsageSnapshot): number | null {
  if (usage.questions.limit === null) return null;
  return Math.max(0, usage.questions.limit - usage.questions.used);
}

const MESSAGES: Record<LimitCode, Record<Tier, string>> = {
  document_limit: {
    trial: "Your free preview covers one document. Sign up free for three.",
    free: "Your free plan covers three documents. Upgrade for unlimited.",
    paid: "Document limit reached.",
  },
  question_limit: {
    trial: "You've used all three preview questions. Sign up free to keep studying.",
    free: "You've used all ten questions for today. Upgrade for unlimited.",
    paid: "Question limit reached.",
  },
};

/**
 * The 403 body. The UI keys off `code` to pick which wall to show; the `error`
 * string is what a direct API caller (curl, a script) sees.
 */
export function limitPayload(code: LimitCode, usage: UsageSnapshot): LimitPayload {
  return { error: MESSAGES[code][usage.tier], code, tier: usage.tier, usage };
}

/**
 * Records one answered question against the user's allowance.
 *
 * Fails open on purpose: the answer has already been generated and returned, so
 * refusing it here would mean charging the user a question and giving nothing
 * back. A failure is logged loudly instead.
 */
export async function recordQuestion(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from("question_events").insert({ user_id: userId });
  if (error) {
    console.error("[limits] failed to record question usage:", error.message);
  }
}

/**
 * The snapshot as it stands after one question is consumed.
 *
 * Lets a route return an up-to-date meter without a second round trip to
 * recount what it already knows.
 */
export function withQuestionSpent(usage: UsageSnapshot): UsageSnapshot {
  if (usage.questions.limit === null) return usage;
  return {
    ...usage,
    questions: {
      ...usage.questions,
      used: usage.questions.used + 1,
      resetsAt:
        usage.questions.resetsAt ??
        (usage.questions.window === "day"
          ? new Date(Date.now() + QUESTION_WINDOW_HOURS * 3600_000).toISOString()
          : null),
    },
  };
}

/** The snapshot after `added` documents land. */
export function withDocumentsAdded(usage: UsageSnapshot, added: number): UsageSnapshot {
  return { ...usage, documents: { ...usage.documents, used: usage.documents.used + added } };
}
