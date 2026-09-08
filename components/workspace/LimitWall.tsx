"use client";

import { useEffect } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { WALL_COPY } from "@/lib/tiers";
import type { LimitCode, Tier, UsageSnapshot } from "@/lib/types";

/**
 * Shown when a tier runs out — the trial's sign-up prompt and the free plan's
 * upgrade prompt are the same modal with different copy.
 *
 * Built on the same shell as ConfirmDialog so hitting a limit feels like part
 * of the product rather than a browser alert.
 */
export function LimitWall({
  open,
  tier,
  code,
  usage,
  onClose,
}: {
  open: boolean;
  tier: Tier;
  code: LimitCode;
  usage: UsageSnapshot | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // A paid account has nothing to be walled off from.
  if (!open || tier === "paid") return null;

  const copy = WALL_COPY[tier];

  const reason =
    code === "question_limit"
      ? usage && usage.questions.limit !== null
        ? `You've asked ${usage.questions.used} of ${usage.questions.limit} ${
            usage.questions.window === "day" ? "questions today" : "preview questions"
          }.`
        : "You've used every question on your plan."
      : usage && usage.documents.limit !== null
        ? `You're using ${usage.documents.used} of ${usage.documents.limit} ${
            usage.documents.limit === 1 ? "document" : "documents"
          }.`
        : "You've used every document slot on your plan.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="fixed inset-0 z-50 grid place-items-center p-4"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 animate-fade-in cursor-default bg-black/40 backdrop-blur-sm"
      />

      <div className="relative w-full max-w-md animate-pop-in rounded-2xl border border-border-base bg-surface p-6 shadow-2xl">
        <span className="grid size-11 place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
          <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
            <path
              d="M12 3.5 14.6 9l6 .9-4.3 4.2 1 6L12 17.3 6.7 20l1-6L3.4 9.9l6-.9L12 3.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </span>

        <h2 className="mt-4 text-lg font-semibold tracking-tight">{copy.title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{copy.body}</p>
        <p className="mt-3 text-xs text-foreground-subtle">{reason}</p>

        <div className="mt-6 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Not now
          </Button>
          {copy.external ? (
            <ButtonLink
              href={copy.href}
              size="sm"
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
            >
              {copy.cta}
            </ButtonLink>
          ) : (
            <ButtonLink href={copy.href} size="sm" onClick={onClose}>
              {copy.cta}
            </ButtonLink>
          )}
        </div>
      </div>
    </div>
  );
}
