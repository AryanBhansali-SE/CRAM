import { Markdown } from "@/lib/markdown";
import { TypingDots } from "@/components/ui/Spinner";
import { QuizCards } from "./QuizCard";
import type { ThreadMessage } from "@/lib/types";

export function MessageBubble({
  message,
  onRetry,
}: {
  message: ThreadMessage;
  onRetry?: (message: ThreadMessage) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex animate-pop-in justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm leading-relaxed text-white shadow-sm shadow-brand-600/20">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-pop-in gap-3">
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-[11px] font-bold text-white"
        aria-hidden
      >
        C
      </span>

      <div className="min-w-0 max-w-[92%] space-y-2">
        <div
          className={`rounded-2xl rounded-tl-md border px-4 py-3 text-sm leading-relaxed ${
            message.error
              ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
              : "border-border-base bg-surface text-foreground"
          }`}
        >
          <Markdown content={message.content} />

          {message.error && message.retry && onRetry && (
            <button
              onClick={() => onRetry(message)}
              className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg border border-red-300 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-red-100 dark:border-red-900 dark:hover:bg-red-950/60"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-3.5" aria-hidden>
                <path
                  d="M4 12a8 8 0 1 1 2.3 5.6M4 12V7m0 5h5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Try again
            </button>
          )}
        </div>

        {message.quiz && message.quiz.length > 0 && <QuizCards items={message.quiz} />}

        {message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-foreground-subtle">Sources</span>
            {message.sources.map((source) => (
              <span
                key={source}
                title={source}
                className="max-w-[14rem] truncate rounded-full border border-border-base bg-surface-muted px-2.5 py-1 text-[11px] text-foreground-muted transition-colors hover:border-brand-300 hover:text-brand-600 dark:hover:text-brand-300"
              >
                {source}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** Placeholder bubble shown while the answer is being generated. */
export function ThinkingBubble() {
  return (
    <div className="flex animate-pop-in gap-3">
      <span
        className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-brand-600 text-[11px] font-bold text-white"
        aria-hidden
      >
        C
      </span>
      <div
        className="flex items-center gap-2.5 rounded-2xl rounded-tl-md border border-border-base bg-surface px-4 py-3.5 text-sm text-foreground-muted"
        aria-live="polite"
      >
        <span className="text-brand-500">
          <TypingDots />
        </span>
        Reading your materials
      </div>
    </div>
  );
}
