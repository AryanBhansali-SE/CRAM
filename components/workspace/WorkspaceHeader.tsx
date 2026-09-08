import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { UserMenu, type SessionUser } from "@/components/auth/UserMenu";

/** Slim app-chrome header. Sits above the workspace, not the marketing site. */
export function WorkspaceHeader({ user }: { user: SessionUser }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-base bg-surface/60 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex items-center gap-3">
        <Logo />
        <span className="hidden rounded-full border border-border-base px-2 py-0.5 text-xs text-foreground-subtle sm:inline">
          Preview
        </span>
      </div>

      <div className="flex items-center gap-1">
        <Link
          href="/"
          className="rounded-lg px-3 py-2 text-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground"
        >
          Home
        </Link>
        <Link
          href="/pricing"
          className="hidden rounded-lg px-3 py-2 text-sm text-foreground-muted transition-colors hover:bg-surface-muted hover:text-foreground sm:block"
        >
          Pricing
        </Link>
        <ThemeToggle />
        <span className="ml-1">
          <UserMenu user={user} />
        </span>
      </div>
    </header>
  );
}
