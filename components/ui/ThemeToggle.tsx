"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

/**
 * The theme lives on <html> as a class, applied by the inline script in the
 * root layout before first paint. That makes it external state, so it's read
 * through useSyncExternalStore rather than mirrored into React state — which
 * also keeps this in sync if anything else toggles the class.
 */
function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

// The server can't know the visitor's theme; the client corrects it right after
// hydration, and the pre-paint script means the page never actually flashes.
function getServerSnapshot(): Theme {
  return "light";
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const next: Theme = theme === "dark" ? "light" : "dark";

  function toggle() {
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("cram-theme", next);
    } catch {
      // Private browsing can block storage; the toggle still works this session.
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${next} mode`}
      className={`grid size-9 place-items-center rounded-lg text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground ${className ?? ""}`}
    >
      {theme === "dark" ? (
        <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
          <circle cx="12" cy="12" r="4.5" fill="currentColor" />
          <path
            d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
          <path d="M20 14.2A8.2 8.2 0 0 1 9.8 4a8.2 8.2 0 1 0 10.2 10.2Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
