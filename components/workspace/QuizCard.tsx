"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { QuizItem } from "@/lib/types";

/**
 * Practice questions with the answers hidden until asked for.
 *
 * The reveal is the point: a quiz that shows its answers alongside the questions
 * is just a summary with question marks. Each card tracks its own state so a
 * student can work down the list at their own pace.
 */
export function QuizCards({ items }: { items: QuizItem[] }) {
  const [revealed, setRevealed] = useState<Set<number>>(new Set());

  const toggle = (index: number) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const allShown = revealed.size === items.length;

  return (
    <div className="space-y-2.5">
      {items.map((item, index) => {
        const open = revealed.has(index);
        return (
          <div
            key={`${index}-${item.question.slice(0, 24)}`}
            className="overflow-hidden rounded-xl border border-border-base bg-surface"
          >
            <div className="flex items-start gap-3 px-4 py-3">
              <span
                className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-md bg-surface-muted text-[11px] font-semibold text-foreground-muted"
                aria-hidden
              >
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-foreground">{item.question}</p>
                <span
                  className={cn(
                    "mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    item.kind === "concept"
                      ? "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                      : "bg-surface-muted text-foreground-subtle"
                  )}
                >
                  {item.kind === "concept" ? "Concept" : "Recall"}
                </span>
              </div>

              <button
                onClick={() => toggle(index)}
                aria-expanded={open}
                className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-brand-600 transition-colors hover:bg-surface-muted dark:text-brand-300"
              >
                {open ? "Hide" : "Reveal"}
              </button>
            </div>

            {open && (
              <div className="animate-fade-in border-t border-border-base bg-surface-muted/60 px-4 py-3 pl-12">
                <p className="text-sm leading-relaxed text-foreground-muted">{item.answer}</p>
              </div>
            )}
          </div>
        );
      })}

      <button
        onClick={() =>
          setRevealed(allShown ? new Set() : new Set(items.map((_, index) => index)))
        }
        className="text-xs font-medium text-foreground-subtle transition-colors hover:text-foreground"
      >
        {allShown ? "Hide all answers" : "Reveal all answers"}
      </button>
    </div>
  );
}
