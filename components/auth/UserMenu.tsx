"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";

export type SessionUser = { id: string; email: string | null; isAnonymous?: boolean };

function initialFor(email: string | null): string {
  return (email?.trim()[0] ?? "?").toUpperCase();
}

/** Avatar button with a dropdown holding the account email and sign-out. */
export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="grid size-8 place-items-center rounded-full bg-brand-600 text-xs font-semibold text-white transition-transform hover:scale-105 active:scale-95"
      >
        {initialFor(user.email)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-60 animate-pop-in overflow-hidden rounded-xl border border-border-base bg-surface shadow-xl"
        >
          <div className="border-b border-border-base px-4 py-3">
            {user.isAnonymous ? (
              <>
                <p className="text-xs text-foreground-subtle">Preview session</p>
                <p className="truncate text-sm font-medium">Not signed up yet</p>
              </>
            ) : (
              <>
                <p className="text-xs text-foreground-subtle">Signed in as</p>
                <p className="truncate text-sm font-medium" title={user.email ?? undefined}>
                  {user.email ?? "your account"}
                </p>
              </>
            )}
          </div>

          <div className="p-1.5">
            <Link
              href="/workspace"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="block rounded-lg px-2.5 py-2 text-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              Workspace
            </Link>

            {/* A preview session has nothing to come back to, so the useful
                action is creating a real account rather than managing this one. */}
            {user.isAnonymous && (
              <Link
                href="/signup"
                onClick={() => setOpen(false)}
                role="menuitem"
                className="block rounded-lg px-2.5 py-2 text-sm font-medium text-brand-600 transition-colors hover:bg-surface-muted dark:text-brand-300"
              >
                Sign up free
              </Link>
            )}

            <form action={signOut}>
              <button
                type="submit"
                role="menuitem"
                className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
              >
                {user.isAnonymous ? "End preview" : "Sign out"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
