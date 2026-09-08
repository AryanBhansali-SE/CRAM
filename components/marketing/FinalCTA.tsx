import { ButtonLink } from "@/components/ui/Button";
import { startHref } from "@/lib/auth-shared";

export function FinalCTA({ authed }: { authed: boolean }) {
  return (
    <section className="border-t border-border-base py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="hero-glow relative overflow-hidden rounded-3xl border border-border-base bg-surface px-6 py-16 text-center sm:px-12">
          <div
            className="grid-bg pointer-events-none absolute inset-0 opacity-30 [mask-image:radial-gradient(60%_60%_at_50%_50%,black,transparent)]"
            aria-hidden
          />
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Your exam is closer than you think
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg leading-relaxed text-foreground-muted">
              Upload your first PDF and ask a question in under a minute.
            </p>
            <ButtonLink href={startHref(authed)} size="lg" className="mt-8">
              {authed ? "Open the workspace" : "Create your free account"}
              <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
                <path
                  d="M5 12h14M13 6l6 6-6 6"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
