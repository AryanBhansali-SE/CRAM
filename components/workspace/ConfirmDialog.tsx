"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Removing a document deletes its chunks from the database and can't be undone,
 * so it gets a confirmation step.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Remove",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 grid place-items-center p-4"
    >
      <button
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 animate-fade-in cursor-default bg-black/40 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-sm animate-pop-in rounded-2xl border border-border-base bg-surface p-6 shadow-2xl">
        <h2 className="font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{body}</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={onConfirm}
            className="bg-red-600 shadow-red-600/20 hover:bg-red-700"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
