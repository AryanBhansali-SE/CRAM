import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/#how-it-works", label: "How it works" },
      { href: "/pricing", label: "Pricing" },
      { href: "/workspace", label: "Open workspace" },
    ],
  },
  {
    title: "Study with Cram",
    links: [
      { href: "/#features", label: "Lecture notes" },
      { href: "/#features", label: "Syllabus Q&A" },
      { href: "/#features", label: "Exam revision" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border-base bg-surface/50">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-foreground-muted">
            Chat with your course materials. Upload your syllabus, get answers, quizzes, and
            summaries — grounded in your own notes.
          </p>
        </div>

        {columns.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold text-foreground">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-foreground-muted transition-colors hover:text-brand-600 dark:hover:text-brand-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-border-base">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-5 py-5 text-xs text-foreground-subtle sm:flex-row">
          <p>© {new Date().getFullYear()} Cram. Built for students.</p>
          <p>Answers are grounded in your uploaded materials.</p>
        </div>
      </div>
    </footer>
  );
}
