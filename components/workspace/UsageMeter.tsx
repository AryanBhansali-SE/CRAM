"use client";

import { resetHint, TIER_LABELS, usageSummary } from "@/lib/tiers";
import type { UsageSnapshot } from "@/lib/types";

/**
 * The quiet "where you stand" line in the sidebar footer.
 *
 * Deliberately understated: limits should be visible before they bite, without
 * turning the workspace into a billing page. Renders nothing while usage is
 * unknown, or when the usage tables aren't live yet.
 */
export function UsageMeter({
  usage,
  onUpgrade,
}: {
  usage: UsageSnapshot | null;
  onUpgrade: () => void;
}) {
  if (!usage || usage.degraded) return null;

  const parts = usageSummary(usage);
  const reset = resetHint(usage);

  if (usage.tier === "paid") {
    return (
      <p className="text-xs leading-relaxed text-foreground-subtle">
        <span className="font-medium text-foreground-muted">{TIER_LABELS.paid}</span> · unlimited
        documents and questions
      </p>
    );
  }

  const questionsLeft =
    usage.questions.limit === null
      ? null
      : Math.max(0, usage.questions.limit - usage.questions.used);
  const runningLow = questionsLeft !== null && questionsLeft <= 2;

  return (
    <div className="space-y-1.5">
      <p className="text-xs leading-relaxed text-foreground-subtle">
        <span className="font-medium text-foreground-muted">{TIER_LABELS[usage.tier]}</span>
        {parts.length > 0 && <> · {parts.join(" · ")}</>}
      </p>

      {runningLow && reset && usage.tier === "free" && (
        <p className="text-xs leading-relaxed text-foreground-subtle">Resets {reset}.</p>
      )}

      <button
        onClick={onUpgrade}
        className="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200"
      >
        {usage.tier === "trial" ? "Sign up free →" : "Upgrade to Pro →"}
      </button>
    </div>
  );
}
