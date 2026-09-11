"use client";

import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn, prettyFilename } from "@/lib/utils";
import type { CramDocument, QueryMode } from "@/lib/types";

/**
 * The study modes, one click away above the composer.
 *
 * These sit in the chat column rather than behind a menu because they're the
 * three things a student actually wants to do with a set of readings, and a
 * blank chat box doesn't suggest any of them.
 *
 * Quiz and Summarize run immediately. Explain needs a concept first, so it opens
 * a small input rather than guessing.
 */
export function QuickActions({
  documents,
  scopeId,
  onScopeChange,
  onRun,
  disabled,
  busy,
}: {
  documents: CramDocument[];
  scopeId: string | null;
  onScopeChange: (id: string | null) => void;
  onRun: (mode: QueryMode, concept?: string) => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  const [explaining, setExplaining] = useState(false);
  const [concept, setConcept] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (explaining) inputRef.current?.focus();
  }, [explaining]);

  if (documents.length === 0) return null;

  function submitConcept() {
    const trimmed = concept.trim();
    if (!trimmed) return;
    onRun("explain", trimmed);
    setConcept("");
    setExplaining(false);
  }

  const chip =
    "inline-flex items-center gap-1.5 rounded-lg border border-border-base bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground-muted transition-all duration-200 hover:border-brand-400 hover:text-brand-600 disabled:pointer-events-none disabled:opacity-50 dark:hover:text-brand-300";

  return (
    <div className="mx-auto w-full max-w-3xl px-1 pb-2">
      {explaining ? (
        <div className="flex items-center gap-2 rounded-xl border border-brand-400 bg-surface p-1.5 shadow-sm">
          <input
            ref={inputRef}
            value={concept}
            onChange={(e) => setConcept(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitConcept();
              if (e.key === "Escape") {
                setExplaining(false);
                setConcept("");
              }
            }}
            placeholder="Which concept? e.g. cellular respiration"
            aria-label="Concept to explain"
            className="min-w-0 flex-1 bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none"
          />
          <button
            onClick={submitConcept}
            disabled={!concept.trim() || busy}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            Explain
          </button>
          <button
            onClick={() => {
              setExplaining(false);
              setConcept("");
            }}
            aria-label="Cancel"
            className="rounded-lg px-2 py-1.5 text-xs text-foreground-subtle transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <button onClick={() => onRun("quiz")} disabled={disabled || busy} className={chip}>
            {busy ? (
              <Spinner className="size-3.5" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
                <path
                  d="M9.5 9a2.5 2.5 0 1 1 3.4 2.3c-.6.3-.9.8-.9 1.4v.6M12 17h.01"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            )}
            Quiz me
          </button>

          <button onClick={() => onRun("summarize")} disabled={disabled || busy} className={chip}>
            <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
              <path
                d="M5 7h14M5 12h14M5 17h8"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            Summarize
          </button>

          <button
            onClick={() => setExplaining(true)}
            disabled={disabled || busy}
            className={chip}
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
              <path
                d="M12 4a5.5 5.5 0 0 0-3 10.1V16h6v-1.9A5.5 5.5 0 0 0 12 4ZM10 19h4"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Explain…
          </button>

          {/* Scope. Hidden with a single document, where "all" and "that one"
              are the same thing and the control would only add noise. */}
          {documents.length > 1 && (
            <label className="ml-auto flex items-center gap-1.5 text-xs text-foreground-subtle">
              <span className="hidden sm:inline">Using</span>
              <select
                value={scopeId ?? ""}
                onChange={(e) => onScopeChange(e.target.value || null)}
                className={cn(
                  "max-w-[12rem] truncate rounded-lg border border-border-base bg-surface px-2 py-1.5 text-xs text-foreground-muted transition-colors hover:border-brand-400 focus:outline-none"
                )}
              >
                <option value="">All documents</option>
                {documents.map((doc) => (
                  <option key={doc.documentId} value={doc.documentId}>
                    {prettyFilename(doc.filename)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
