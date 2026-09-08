"use client";

import { useEffect, useRef, useState } from "react";
import { ChatComposer } from "./ChatComposer";
import { ConfirmDialog } from "./ConfirmDialog";
import { DocumentList } from "./DocumentList";
import { MessageBubble, ThinkingBubble } from "./MessageBubble";
import { NoDocumentsState, NoMessagesState } from "./ChatEmptyState";
import { UploadDropzone } from "./UploadDropzone";
import { useWorkspace } from "./useWorkspace";
import { cn, formatCount } from "@/lib/utils";
import type { CramDocument } from "@/lib/types";

const noticeStyles = {
  info: "border-border-base bg-surface-muted text-foreground-muted",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300",
  error: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300",
} as const;

export function Workspace() {
  const ws = useWorkspace();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<CramDocument | null>(null);

  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the newest message and to the thinking indicator.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [ws.messages, ws.asking]);

  // Success notices are transient; errors stay until the next action.
  useEffect(() => {
    if (ws.notice?.tone !== "success") return;
    const timer = setTimeout(() => ws.setNotice(null), 4000);
    return () => clearTimeout(timer);
  }, [ws.notice, ws]);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-4 pb-3 pt-4">
        <UploadDropzone onFiles={ws.upload} uploading={ws.uploading} />
        {ws.notice && (
          <p
            className={cn(
              "mt-2.5 animate-fade-in rounded-lg border px-3 py-2 text-xs leading-relaxed",
              noticeStyles[ws.notice.tone]
            )}
            role="status"
          >
            {ws.notice.text}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between px-5 pb-2">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-foreground-subtle">
          Materials
        </h2>
        {ws.documents.length > 0 && (
          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-foreground-muted">
            {ws.documents.length}
          </span>
        )}
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <DocumentList
          documents={ws.documents}
          loading={ws.docsLoading}
          error={ws.docsError}
          removingId={ws.removingId}
          onRemove={setPendingRemoval}
          onRetry={ws.loadDocuments}
        />
      </div>

      {ws.documents.length > 0 && (
        <div className="border-t border-border-base px-5 py-3">
          <p className="text-xs leading-relaxed text-foreground-subtle">
            Questions search all {formatCount(ws.documents.length, "document")} together.
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1">
      {/* Desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-border-base bg-surface/50 lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            aria-label="Close materials"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 animate-fade-in cursor-default bg-black/40 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 w-80 max-w-[85vw] animate-fade-in border-r border-border-base bg-background shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-base px-5 py-3.5">
              <h2 className="font-semibold tracking-tight">Materials</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-lg text-foreground-muted hover:bg-surface-muted"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
                  <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </button>
            </div>
            <div className="h-[calc(100%-3.5rem)]">{sidebar}</div>
          </aside>
        </div>
      )}

      {/* Chat column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border-base px-4 py-2.5 sm:px-6 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-base px-3 py-1.5 text-sm text-foreground-muted transition-colors hover:bg-surface-muted"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
              <path
                d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4l2 2h7A1.5 1.5 0 0 1 20 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
            Materials
            {ws.documents.length > 0 && (
              <span className="rounded-full bg-brand-600 px-1.5 text-xs text-white">
                {ws.documents.length}
              </span>
            )}
          </button>

          {ws.messages.length > 0 && (
            <button
              onClick={ws.clearThread}
              className="text-sm text-foreground-subtle transition-colors hover:text-foreground"
            >
              New chat
            </button>
          )}
        </div>

        <div ref={threadRef} className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
          {!ws.docsLoading && !ws.hasDocuments && ws.messages.length === 0 ? (
            <NoDocumentsState onFiles={ws.upload} uploading={ws.uploading} />
          ) : ws.messages.length === 0 ? (
            ws.docsLoading ? (
              <div className="h-full" />
            ) : (
              <NoMessagesState documentCount={ws.documents.length} onPick={(q) => void ws.send(q)} />
            )
          ) : (
            <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8 sm:px-6">
              {ws.messages.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {ws.asking && <ThinkingBubble />}
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        <ChatComposer
          value={ws.input}
          onChange={ws.setInput}
          onSubmit={() => void ws.send()}
          busy={ws.asking}
          disabled={!ws.hasDocuments && !ws.docsLoading}
          placeholder={
            ws.hasDocuments ? "Ask about your materials…" : "Upload a PDF to get started…"
          }
        />
      </div>

      <ConfirmDialog
        open={pendingRemoval !== null}
        title="Remove this document?"
        body={`${pendingRemoval?.filename ?? ""} and its indexed passages will be deleted. You'd need to upload it again to ask about it.`}
        onCancel={() => setPendingRemoval(null)}
        onConfirm={() => {
          if (pendingRemoval) void ws.remove(pendingRemoval);
          setPendingRemoval(null);
        }}
      />
    </div>
  );
}
