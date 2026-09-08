"use client";

import { Spinner } from "@/components/ui/Spinner";
import { formatCount, prettyFilename } from "@/lib/utils";
import type { CramDocument } from "@/lib/types";

function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
      <path
        d="M13.5 3.5H7.5A1.5 1.5 0 0 0 6 5v14a1.5 1.5 0 0 0 1.5 1.5h9A1.5 1.5 0 0 0 18 19V8l-4.5-4.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M13.5 3.5V8H18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function DocumentSkeleton() {
  return (
    <div className="space-y-1.5" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-2.5 rounded-lg px-2 py-2.5">
          <div className="skeleton size-8 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="skeleton h-3 rounded" style={{ width: `${70 - i * 12}%` }} />
            <div className="skeleton h-2.5 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DocumentList({
  documents,
  loading,
  error,
  removingId,
  onRemove,
  onRetry,
}: {
  documents: CramDocument[];
  loading: boolean;
  error: string | null;
  removingId: string | null;
  onRemove: (doc: CramDocument) => void;
  onRetry: () => void;
}) {
  if (loading) return <DocumentSkeleton />;

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
        <p className="leading-relaxed">{error}</p>
        <button
          onClick={onRetry}
          className="mt-2 font-medium underline underline-offset-2 hover:no-underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <p className="px-2 text-xs leading-relaxed text-foreground-subtle">
        No documents yet. Add a few PDFs and Cram will search across all of them at once.
      </p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {documents.map((doc) => {
        const removing = removingId === doc.documentId;
        return (
          <li
            key={doc.documentId}
            className="group flex animate-fade-in items-center gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-muted"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-brand-600 transition-colors group-hover:bg-surface dark:text-brand-300">
              <FileIcon />
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-foreground" title={doc.filename}>
                {prettyFilename(doc.filename)}
              </p>
              <p className="text-xs text-foreground-subtle">{formatCount(doc.chunks, "passage")}</p>
            </div>

            <button
              onClick={() => onRemove(doc)}
              disabled={removing}
              title={`Remove ${doc.filename}`}
              aria-label={`Remove ${doc.filename}`}
              className="grid size-7 shrink-0 place-items-center rounded-md text-foreground-subtle opacity-0 transition-all hover:bg-red-50 hover:text-red-600 focus-visible:opacity-100 group-hover:opacity-100 disabled:opacity-50 dark:hover:bg-red-950/50 dark:hover:text-red-400"
            >
              {removing ? (
                <Spinner className="size-3.5" />
              ) : (
                <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
                  <path
                    d="M5 7h14M10 7V5.5A1.5 1.5 0 0 1 11.5 4h1A1.5 1.5 0 0 1 14 5.5V7m3 0v12a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19V7"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
