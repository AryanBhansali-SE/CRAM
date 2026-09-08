import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

/** Centered, distraction-free shell for sign-in and sign-up. */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="hero-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div
        className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-[0.3] [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]"
        aria-hidden
      />

      <header className="flex h-16 items-center justify-between px-5">
        <Logo />
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm rounded-2xl border border-border-base bg-surface p-7 shadow-xl shadow-brand-900/5 sm:p-8">
          {children}
        </div>
      </main>

      <footer className="px-5 py-6 text-center text-xs text-foreground-subtle">
        Answers are grounded in the materials you upload.
      </footer>
    </div>
  );
}
