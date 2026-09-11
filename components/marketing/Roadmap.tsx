import { Badge } from "@/components/ui/Card";

/**
 * What's coming next, on the pricing page.
 *
 * This replaces the old "Study group" plan card and the coming-soon footnote
 * that sat under the tiers. A card with a price and a button implies you can buy
 * it; none of this is buyable yet, so it reads as a roadmap instead — every item
 * carries a "Coming soon" badge and nothing here has a call to action.
 *
 * Predicted exam papers leads because it's the flagship, so it gets the full
 * width, the brand border and the glow, while the rest sit in a quieter grid
 * beneath it.
 */

const UPCOMING = [
  {
    title: "Mock exams from your notes",
    body: "Sit a full timed paper drawn from your own material, then see where the marks went.",
  },
  {
    title: "Weakness tracking",
    body: "Cram remembers what you get wrong, and points you at the topics that need another pass.",
  },
  {
    title: "Study groups",
    body: "Share a library with your class, so nobody uploads the same lecture twice.",
  },
];

function ComingSoon() {
  return (
    <Badge className="border-border-base bg-surface-muted text-foreground-subtle">
      <span className="size-1.5 rounded-full bg-accent-500" aria-hidden />
      Coming soon
    </Badge>
  );
}

export function Roadmap() {
  return (
    <section id="roadmap" className="scroll-mt-20 border-t border-border-base py-20 lg:py-24">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
            Roadmap
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            What we&apos;re building next
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-foreground-muted">
            Everything below is grounded in the same place Cram already works from — the materials
            you upload.
          </p>
        </div>

        {/* Flagship */}
        <div className="relative mt-12 overflow-hidden rounded-2xl border border-brand-500 bg-surface p-7 shadow-xl shadow-brand-600/10 sm:p-9">
          <div
            className="hero-glow pointer-events-none absolute inset-0 -z-10 opacity-70"
            aria-hidden
          />

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-3xl leading-none" aria-hidden>
              🎯
            </span>
            <ComingSoon />
          </div>

          <h3 className="mt-5 max-w-2xl text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
            Predicted exam papers
          </h3>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground-muted sm:text-lg">
            Upload your past-year question papers and Cram spots the recurring questions, topics,
            and patterns to generate a practice paper for your upcoming exam.
          </p>
        </div>

        {/* Everything else */}
        <div className="mt-6 grid gap-6 sm:grid-cols-3">
          {UPCOMING.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-border-base bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-border-strong"
            >
              <ComingSoon />
              <h3 className="mt-4 font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{item.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-foreground-subtle">
          No dates promised. Free and Pro are what you can use today.
        </p>
      </div>
    </section>
  );
}
