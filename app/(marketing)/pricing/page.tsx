import type { Metadata } from "next";
import { Pricing } from "@/components/marketing/Pricing";
import { Roadmap } from "@/components/marketing/Roadmap";
import { FinalCTA } from "@/components/marketing/FinalCTA";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple plans for students — start free and upgrade when exams pile up.",
};

const faqs = [
  {
    q: "Do I need to pay to try it?",
    a: "No. The free plan covers three documents and ten questions a day, which is enough to get through a midterm. You can also preview Cram without an account at all — one document and three questions.",
  },
  {
    q: "What happens to my documents?",
    a: "They're indexed so Cram can search them, and you can remove any document — and everything indexed from it — at any time from the workspace.",
  },
  {
    q: "Can Cram answer from outside my materials?",
    a: "No, and that's the point. Answers are grounded in the passages retrieved from your uploads. If something isn't there, Cram says so.",
  },
  {
    q: "When do the daily questions reset?",
    a: "They roll: each question frees up again 24 hours after you asked it, so you're never waiting on a fixed midnight in some other timezone.",
  },
];

export default async function PricingPage() {
  const user = await getUser();
  // An anonymous preview visitor hasn't signed up, so the CTAs still say so.
  const authed = !!user && !user.is_anonymous;

  return (
    <>
      <section className="relative overflow-hidden border-b border-border-base">
        <div className="hero-glow pointer-events-none absolute inset-0 -z-10" aria-hidden />
        <div className="mx-auto w-full max-w-3xl px-5 py-20 text-center lg:py-24">
          <h1 className="animate-fade-up text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Plans for every kind of semester
          </h1>
          <p className="animate-fade-up mt-5 text-lg leading-relaxed text-foreground-muted [animation-delay:60ms]">
            Start free and upgrade when one exam turns into five.
          </p>
        </div>
      </section>

      <Pricing authed={authed} showHeader={false} />

      <Roadmap />

      <section className="border-t border-border-base py-20">
        <div className="mx-auto w-full max-w-3xl px-5">
          <h2 className="text-2xl font-semibold tracking-tight">Common questions</h2>
          <dl className="mt-8 divide-y divide-[var(--border)]">
            {faqs.map((faq) => (
              <div key={faq.q} className="py-5">
                <dt className="font-medium">{faq.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-foreground-muted">{faq.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <FinalCTA authed={authed} />
    </>
  );
}
