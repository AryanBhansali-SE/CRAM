"use client";

import { useEffect, useRef } from "react";
import { Spinner } from "@/components/ui/Spinner";

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  busy,
  placeholder,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  busy?: boolean;
  placeholder: string;
  /** Replaces the keyboard-shortcut footer, e.g. when the allowance is spent. */
  hint?: string;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Grow the textarea with its content, up to a cap.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 176)}px`;
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  }

  const canSend = !busy && !disabled && value.trim().length > 0;

  return (
    <div className="border-t border-border-base bg-background/80 px-4 py-4 backdrop-blur-xl sm:px-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-end gap-2 rounded-2xl border border-border-base bg-surface p-2 shadow-sm transition-all duration-200 focus-within:border-brand-400 focus-within:shadow-md focus-within:shadow-brand-600/5">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Ask a question about your materials"
            className="max-h-44 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-2 text-sm leading-relaxed text-foreground placeholder:text-foreground-subtle focus:outline-none disabled:cursor-not-allowed"
          />
          <button
            onClick={onSubmit}
            disabled={!canSend}
            aria-label="Send question"
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand-600 text-white transition-all duration-200 hover:bg-brand-700 active:scale-95 disabled:bg-surface-muted disabled:text-foreground-subtle"
          >
            {busy ? (
              <Spinner className="size-4" />
            ) : (
              <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
                <path
                  d="M5 12h13M12 5.5 18.5 12 12 18.5"
                  stroke="currentColor"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-2 px-1 text-xs text-foreground-subtle">
          {hint ??
            (disabled
              ? "Upload a PDF to start asking questions."
              : "Enter to send · Shift + Enter for a new line")}
        </p>
      </div>
    </div>
  );
}
