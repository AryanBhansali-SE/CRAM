import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { startHref } from "@/lib/auth-shared";
import { UPGRADE_URL } from "@/lib/tiers";

/**
 * The Free and Pro rows describe the allowances that lib/limits.ts actually
 * enforces — keep the two in step if either changes.
 */
const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    tagline: "Enough to get through a midterm.",
    features: ["3 documents", "10 questions a day", "Answers with sources", "Summaries"],
    cta: "Start free",
    featured: false,
    external: false,
  },
  {
    name: "Pro",
    price: "$8",
    cadence: "per month",
    tagline: "For a full course load, all semester.",
    features: [
      "Unlimited documents",
      "Unlimited questions",
      "Quizzes and flashcards",
      "Priority processing",
      "Export summaries",
    ],
    cta: "Upgrade to Pro",
    featured: true,
    external: true,
  },
  {
    name: "Study group",
    price: "$20",
    cadence: "per month",
    tagline: "Share a library with your classmates.",
    features: ["Everything in Pro", "Up to 5 seats", "Shared document library", "Group chat history"],
    cta: "Get Study group",
    featured: false,
    external: false,
  },
];

function Check() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="mt-0.5 size-4 shrink-0" aria-hidden>
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Pricing({
  authed,
  heading = "Pricing that fits a student budget",
  subheading = "Start free. Upgrade when you have more than one exam to worry about.",
  showHeader = true,
}: {
  authed: boolean;
  heading?: string;
  subheading?: string;
  showHeader?: boolean;
}) {
  return (
    <section id="pricing" className="scroll-mt-20 border-t border-border-base py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl px-5">
        {showHeader && (
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
              Pricing
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              {heading}
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-foreground-muted">{subheading}</p>
          </div>
        )}

        <div className="mt-12 grid items-start gap-6 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "relative rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1",
                tier.featured
                  ? "border-brand-500 bg-surface shadow-xl shadow-brand-600/10 lg:-mt-4 lg:pb-10"
                  : "border-border-base bg-surface hover:border-border-strong"
              )}
            >
              {tier.featured && (
                <span className="absolute -top-3 left-7 rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  Most popular
                </span>
              )}

              <h3 className="font-semibold tracking-tight">{tier.name}</h3>
              <p className="mt-1 text-sm text-foreground-muted">{tier.tagline}</p>

              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-4xl font-semibold tracking-tight">{tier.price}</span>
                <span className="text-sm text-foreground-subtle">{tier.cadence}</span>
              </div>

              <ButtonLink
                href={tier.external ? UPGRADE_URL : startHref(authed)}
                variant={tier.featured ? "primary" : "secondary"}
                className="mt-6 w-full"
                {...(tier.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              >
                {tier.cta}
              </ButtonLink>

              <ul className="mt-7 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex gap-2.5 text-sm text-foreground-muted">
                    <span className={tier.featured ? "text-brand-600 dark:text-brand-300" : "text-emerald-600 dark:text-emerald-400"}>
                      <Check />
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-foreground-subtle">
          Free and Pro are live. Study group is still on the way — start free and upgrade whenever
          the reading piles up.
        </p>
      </div>
    </section>
  );
}
