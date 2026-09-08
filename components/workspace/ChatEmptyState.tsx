"use client";

import { UploadDropzone } from "./UploadDropzone";

const SUGGESTIONS = [
  "Summarise the key points across all my documents",
  "What topics show up in more than one file?",
  "Quiz me with five questions on this material",
  "Explain the hardest concept here in simple terms",
];

/** Shown before the first upload — the guided first-run state. */
export function NoDocumentsState({
  onFiles,
  uploading,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
}) {
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col justify-center px-5 py-12">
      <div className="animate-fade-up text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/25">
          <svg viewBox="0 0 24 24" fill="none" className="size-7" aria-hidden>
            <path
              d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9a2 2 0 0 1 2 2v12a1.5 1.5 0 0 0-1.5-1.5h-4A1.5 1.5 0 0 1 4 15V5.5Z"
              fill="currentColor"
              opacity="0.55"
            />
            <path
              d="M20 5.5A1.5 1.5 0 0 0 18.5 4H15a2 2 0 0 0-2 2v12a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 0 20 15V5.5Z"
              fill="currentColor"
            />
          </svg>
        </span>

        <h2 className="mt-5 text-2xl font-semibold tracking-tight">Add your course materials</h2>
        <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-foreground-muted">
          Upload your syllabus, lecture slides, or readings as PDFs. Cram indexes every page, then
          answers questions across all of them at once.
        </p>
      </div>

      <UploadDropzone
        variant="panel"
        onFiles={onFiles}
        uploading={uploading}
        className="animate-fade-up mt-8 bg-surface [animation-delay:80ms]"
      />

      <ul className="animate-fade-up mt-6 grid gap-2 text-sm text-foreground-muted [animation-delay:140ms] sm:grid-cols-3">
        {[
          "Multiple PDFs at once",
          "Answers cite their source",
          "Nothing invented",
        ].map((item) => (
          <li key={item} className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-emerald-500" aria-hidden>
              <path
                d="m5 12.5 4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Documents are loaded but the thread is empty — offer starting points. */
export function NoMessagesState({
  documentCount,
  onPick,
}: {
  documentCount: number;
  onPick: (question: string) => void;
}) {
  return (
    <div className="mx-auto flex h-full max-w-2xl flex-col justify-center px-5 py-12 text-center">
      <div className="animate-fade-up">
        <h2 className="text-2xl font-semibold tracking-tight">
          Ready when you are
        </h2>
        <p className="mx-auto mt-2.5 max-w-md text-sm leading-relaxed text-foreground-muted">
          Cram has read {documentCount === 1 ? "your document" : `all ${documentCount} of your documents`}.
          Ask anything — or start with one of these.
        </p>
      </div>

      <div className="animate-fade-up mt-8 grid gap-2.5 text-left [animation-delay:80ms] sm:grid-cols-2">
        {SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => onPick(suggestion)}
            className="group rounded-xl border border-border-base bg-surface px-4 py-3.5 text-sm text-foreground-muted transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:text-foreground hover:shadow-md hover:shadow-brand-900/5 dark:hover:border-brand-700"
          >
            <span className="flex items-start justify-between gap-3">
              {suggestion}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="mt-0.5 size-4 shrink-0 text-foreground-subtle transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-brand-500"
                aria-hidden
              >
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
