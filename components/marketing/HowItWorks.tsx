const steps = [
  {
    step: "01",
    title: "Upload your materials",
    body: "Drag in your syllabus, lecture slides, and readings — as many PDFs as you like, all at once.",
  },
  {
    step: "02",
    title: "Cram reads everything",
    body: "Each document is split into passages and indexed, so Cram can find the exact paragraph that answers a question.",
  },
  {
    step: "03",
    title: "Ask anything",
    body: "Question your whole semester at once. Every answer cites the documents it came from, and follow-ups just work.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-20 border-t border-border-base bg-surface/40 py-20 lg:py-28"
    >
      <div className="mx-auto w-full max-w-6xl px-5">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">
            How it works
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Three steps, about a minute
          </h2>
        </div>

        <ol className="mt-12 grid gap-6 md:grid-cols-3">
          {steps.map((item, i) => (
            <li key={item.step} className="relative">
              {/* Connector line between steps on wide screens. */}
              {i < steps.length - 1 && (
                <span
                  className="absolute left-[calc(2.5rem+0.75rem)] top-5 hidden h-px w-[calc(100%-3.5rem)] bg-gradient-to-r from-border-strong to-transparent md:block"
                  aria-hidden
                />
              )}
              <span className="grid size-10 place-items-center rounded-xl bg-brand-600 text-sm font-semibold text-white shadow-sm shadow-brand-600/30">
                {item.step}
              </span>
              <h3 className="mt-4 font-semibold tracking-tight">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
