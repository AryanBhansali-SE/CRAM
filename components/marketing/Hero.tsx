import { ButtonLink } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Card";
import { startHref } from "@/lib/auth-shared";

/** A static preview of the workspace, so visitors see the product immediately. */
function ChatPreview() {
  return (
    <div className="animate-fade-up rounded-2xl border border-border-base bg-surface shadow-2xl shadow-brand-900/10 [animation-delay:240ms] dark:shadow-black/40">
      <div className="flex items-center gap-2 border-b border-border-base px-4 py-3">
        <div className="flex gap-1.5" aria-hidden>
          <span className="size-2.5 rounded-full bg-red-400/70" />
          <span className="size-2.5 rounded-full bg-amber-400/70" />
          <span className="size-2.5 rounded-full bg-emerald-400/70" />
        </div>
        <p className="ml-2 text-xs text-foreground-subtle">BIOL 210 — 4 documents</p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-md bg-brand-600 px-4 py-2.5 text-sm text-white">
            What&apos;s on the midterm, and what should I review first?
          </p>
        </div>

        <div className="max-w-[88%] space-y-2">
          <div className="rounded-2xl rounded-bl-md border border-border-base bg-surface-muted px-4 py-3 text-sm leading-relaxed text-foreground">
            Your midterm covers lectures 1–7. Based on the study guide, start with{" "}
            <span className="font-medium text-brand-600 dark:text-brand-300">
              cellular respiration
            </span>{" "}
            — it&apos;s weighted at 30% and appears in both problem sets.
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["syllabus.pdf", "lecture-03.pdf", "study-guide.pdf"].map((f) => (
              <span
                key={f}
                className="rounded-full border border-border-base bg-surface px-2.5 py-1 text-[11px] text-foreground-subtle"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Hero({ authed }: { authed: boolean }) {
  return (
    <section className="relative overflow-hidden">
      <div className="hero-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
      <div
        className="grid-bg pointer-events-none absolute inset-0 -z-10 opacity-[0.35] [mask-image:radial-gradient(60%_50%_at_50%_0%,black,transparent)]"
        aria-hidden
      />

      <div className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 py-20 lg:grid-cols-2 lg:py-28">
        <div>
          <Badge className="animate-fade-up bg-surface/70 backdrop-blur">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Grounded in your own notes
          </Badge>

          <h1 className="animate-fade-up mt-5 text-4xl font-semibold leading-[1.08] tracking-tight text-balance [animation-delay:60ms] sm:text-5xl lg:text-6xl">
            Chat with your{" "}
            <span className="bg-gradient-to-r from-brand-600 to-accent-500 bg-clip-text text-transparent">
              course materials
            </span>
          </h1>

          <p className="animate-fade-up mt-5 max-w-xl text-lg leading-relaxed text-foreground-muted [animation-delay:120ms]">
            Upload your syllabus, lecture slides, and readings. Cram reads all of them and answers
            your questions — with quizzes and summaries drawn straight from your own material, not
            the open internet.
          </p>

          <div className="animate-fade-up mt-8 flex flex-wrap items-center gap-3 [animation-delay:180ms]">
            <ButtonLink href={startHref(authed)} size="lg">
              {authed ? "Open your workspace" : "Start studying — it's free"}
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
            <ButtonLink href="/#how-it-works" size="lg" variant="secondary">
              See how it works
            </ButtonLink>
          </div>

          <p className="animate-fade-up mt-5 text-sm text-foreground-subtle [animation-delay:220ms]">
            {authed ? "Your materials are ready when you are." : "No credit card. Free to start."}
          </p>
        </div>

        <ChatPreview />
      </div>
    </section>
  );
}
