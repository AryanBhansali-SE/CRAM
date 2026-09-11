"use client";

import { useRef, useState } from "react";
import { Spinner } from "@/components/ui/Spinner";
import { cn } from "@/lib/utils";
import { MAX_FILE_BYTES, megabytes } from "@/lib/uploads";

const ACCEPT = ".pdf,application/pdf";

/**
 * Everything dropped is handed on, including the files we can't read.
 *
 * Silently discarding a dragged .docx looked like the app had ignored the drop.
 * The upload pipeline screens by type and size before sending anything, so the
 * user gets "lecture.docx isn't a PDF" by name and nothing is wasted on the wire.
 */
function droppedFiles(list: FileList | null): File[] {
  return Array.from(list ?? []).filter((f) => f.size > 0);
}

/**
 * Drag-and-drop plus click-to-browse. `variant="panel"` is the large empty-state
 * target; `variant="compact"` is the small one that lives in the sidebar.
 */
export function UploadDropzone({
  onFiles,
  uploading,
  variant = "compact",
  className,
}: {
  onFiles: (files: File[]) => void;
  uploading: boolean;
  variant?: "compact" | "panel";
  className?: string;
}) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Nested dragenter/dragleave events fire constantly; count them instead of
  // toggling, so the highlight doesn't flicker over child elements.
  const dragDepth = useRef(0);

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (uploading) return;
    const files = droppedFiles(e.dataTransfer.files);
    if (files.length > 0) onFiles(files);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = droppedFiles(e.target.files);
    if (files.length > 0) onFiles(files);
    e.target.value = "";
  }

  const isPanel = variant === "panel";

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        dragDepth.current += 1;
        if (!uploading) setDragging(true);
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault();
        dragDepth.current -= 1;
        if (dragDepth.current <= 0) setDragging(false);
      }}
      onDrop={handleDrop}
      className={cn(
        "group relative rounded-xl border border-dashed transition-all duration-200",
        dragging
          ? "border-brand-500 bg-brand-50 dark:bg-brand-500/10"
          : "border-border-strong hover:border-brand-400 hover:bg-surface-muted/60",
        uploading && "pointer-events-none opacity-70",
        isPanel ? "p-10" : "p-4",
        className
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="sr-only"
        onChange={handleChange}
        disabled={uploading}
        aria-label="Upload PDFs"
      />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex w-full flex-col items-center gap-2 text-center"
      >
        <span
          className={cn(
            "grid place-items-center rounded-xl transition-all duration-200",
            dragging ? "bg-brand-600 text-white" : "bg-surface-muted text-brand-600 dark:text-brand-300",
            isPanel ? "size-14" : "size-10 group-hover:scale-105"
          )}
        >
          {uploading ? (
            <Spinner className={isPanel ? "size-6" : "size-4"} />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" className={isPanel ? "size-7" : "size-5"} aria-hidden>
              <path
                d="M12 16V4.5M12 4.5 7.5 9M12 4.5 16.5 9M4.5 15v2.5A2.5 2.5 0 0 0 7 20h10a2.5 2.5 0 0 0 2.5-2.5V15"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        <span className={cn("font-medium text-foreground", isPanel ? "text-base" : "text-sm")}>
          {uploading ? "Processing your PDFs…" : dragging ? "Drop to upload" : "Add PDFs"}
        </span>
        <span className={cn("text-foreground-subtle", isPanel ? "text-sm" : "text-xs")}>
          {uploading
            ? "This can take a minute for long documents"
            : `Drag and drop, or click to browse · PDFs up to ${megabytes(MAX_FILE_BYTES)}`}
        </span>
      </button>
    </div>
  );
}
