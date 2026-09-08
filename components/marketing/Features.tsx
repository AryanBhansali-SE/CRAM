import type { ReactNode } from "react";

type Feature = {
  title: string;
  body: string;
  icon: ReactNode;
  accent: string;
};

const features: Feature[] = [
  {
    title: "Answers from your syllabus",
    body: "Ask anything about your uploaded PDFs and get a direct answer, with the source documents cited underneath.",
    accent: "text-brand-600 dark:text-brand-300",
    icon: (
      <path
        d="M8 10h8M8 14h5M6.5 4h11A2.5 2.5 0 0 1 20 6.5v8a2.5 2.5 0 0 1-2.5 2.5H12l-4.5 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5v-8A2.5 2.5 0 0 1 6.5 4Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Every document at once",
    body: "Load a whole semester. Cram searches across all of your files together, so questions can span lectures, readings, and the syllabus.",
    accent: "text-accent-600 dark:text-accent-400",
    icon: (
      <path
        d="M4 7.5A1.5 1.5 0 0 1 5.5 6h4l2 2h7A1.5 1.5 0 0 1 20 9.5v7a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Follow-ups that make sense",
    body: 'Say "explain that more" or "what about the second point" — Cram tracks the conversation and still pulls the right passages.',
    accent: "text-emerald-600 dark:text-emerald-400",
    icon: (
      <path
        d="M4 12a8 8 0 1 1 3.2 6.4L4 19.5l1.1-3.2A7.9 7.9 0 0 1 4 12Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Quizzes and summaries",
    body: "Turn a dense reading into a short summary, or ask Cram to quiz you on a chapter before the exam.",
    accent: "text-rose-600 dark:text-rose-400",
    icon: (
      <path
        d="M12 4.5 13.9 9l4.6.4-3.5 3 1.1 4.5L12 14.6 7.9 16.9 9 12.4l-3.5-3L10.1 9 12 4.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "No made-up answers",
    body: "If something isn't in your materials, Cram says so instead of inventing it. What you read is what you uploaded.",
    accent: "text-sky-600 dark:text-sky-400",
    icon: (
      <path
        d="M12 3.5 19 6v6c0 4.2-2.9 7.5-7 8.5-4.1-1-7-4.3-7-8.5V6l7-2.5ZM9.5 12l1.8 1.8 3.4-3.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Built for cramming",
    body: "Drag in a stack of PDFs the night before and start asking. Uploads process in parallel and are ready in seconds.",
    accent: "text-violet-600 dark:text-violet-400",
    icon: (
      <path
        d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12L13 3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-border-base py-20 lg:py-28">
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
            Features
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Everything you need the week before an exam
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-foreground-muted">
            Cram is a study partner that has actually read your course materials.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-border-base bg-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-brand-300 hover:shadow-lg hover:shadow-brand-900/5 dark:hover:border-brand-700"
            >
              <span
                className={`grid size-11 place-items-center rounded-xl bg-surface-muted transition-transform duration-300 group-hover:scale-105 ${feature.accent}`}
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-5.5" aria-hidden>
                  {feature.icon}
                </svg>
              </span>
              <h3 className="mt-4 font-semibold tracking-tight">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{feature.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
