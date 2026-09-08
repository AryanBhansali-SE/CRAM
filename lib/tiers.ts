/**
 * Tier presentation: the copy and links the walls and meter render.
 *
 * Deliberately free of server-only imports so client components can use it.
 * The numbers users are *held* to live in lib/limits.ts — these strings only
 * describe them.
 */

import type { Tier, UsageSnapshot } from "./types";

/** Whop checkout for Cram Pro. Payment integration proper comes next. */
export const UPGRADE_URL = "https://whop.com/cram-977c/cram-cf";

export const PRO_PRICE = "$8/month";

/** Copy for the wall shown when a tier runs out. */
export const WALL_COPY: Record<
  Exclude<Tier, "paid">,
  { title: string; body: string; cta: string; href: string; external: boolean }
> = {
  trial: {
    title: "You've used your free preview.",
    body: "Sign up free to keep studying — 3 documents and 10 questions a day, no card needed.",
    cta: "Sign up free",
    href: "/signup",
    external: false,
  },
  free: {
    title: "You've hit your free limit.",
    body: `Upgrade to Cram Pro for unlimited documents and questions — ${PRO_PRICE}.`,
    cta: "Upgrade",
    href: UPGRADE_URL,
    external: true,
  },
};

export const TIER_LABELS: Record<Tier, string> = {
  trial: "Preview",
  free: "Free",
  paid: "Pro",
};

/**
 * "2 of 3 documents" / "7 questions left today" — the subtle meter copy.
 * Returns null when there is nothing meaningful to show (unlimited, or the
 * usage tables aren't live yet).
 */
export function usageSummary(usage: UsageSnapshot | null): string[] {
  if (!usage || usage.degraded) return [];

  const parts: string[] = [];

  if (usage.documents.limit !== null) {
    parts.push(`${usage.documents.used} of ${usage.documents.limit} documents`);
  }

  if (usage.questions.limit !== null) {
    const left = Math.max(0, usage.questions.limit - usage.questions.used);
    const noun = left === 1 ? "question" : "questions";
    parts.push(
      usage.questions.window === "day"
        ? `${left} ${noun} left today`
        : `${left} ${noun} left`
    );
  }

  return parts;
}

/** Whether the user can still ask. Mirrors the server check, for UI state only. */
export function outOfQuestions(usage: UsageSnapshot | null): boolean {
  if (!usage || usage.degraded || usage.questions.limit === null) return false;
  return usage.questions.used >= usage.questions.limit;
}

/** Whether the user can still upload. Mirrors the server check, for UI state only. */
export function outOfDocuments(usage: UsageSnapshot | null): boolean {
  if (!usage || usage.degraded || usage.documents.limit === null) return false;
  return usage.documents.used >= usage.documents.limit;
}

/** "in 4 hours" / "in 25 minutes" — when the oldest question ages out. */
export function resetHint(usage: UsageSnapshot | null): string | null {
  if (!usage || usage.questions.window !== "day" || !usage.questions.resetsAt) return null;

  const ms = new Date(usage.questions.resetsAt).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;

  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;

  const hours = Math.round(minutes / 60);
  return `in ${hours} hour${hours === 1 ? "" : "s"}`;
}
