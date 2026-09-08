import { ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-5">
      <div className="text-center">
        <Logo className="justify-center" />
        <p className="mt-8 text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
          404
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">This page isn&apos;t in your notes</h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-foreground-muted">
          The page you were looking for doesn&apos;t exist. Head back and pick up where you left off.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <ButtonLink href="/">Back home</ButtonLink>
          <ButtonLink href="/workspace" variant="secondary">
            Open workspace
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
