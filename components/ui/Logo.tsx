import Link from "next/link";
import { cn } from "@/lib/utils";

/** The Cram wordmark: a stacked-books glyph plus the name. */
export function Logo({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex items-center gap-2 rounded-lg font-semibold tracking-tight",
        className
      )}
      aria-label="Cram home"
    >
      <span className="relative grid size-8 place-items-center rounded-lg bg-brand-600 text-white shadow-sm shadow-brand-600/30 transition-transform duration-200 group-hover:-rotate-6">
        <svg viewBox="0 0 24 24" fill="none" className="size-4.5" aria-hidden>
          <path
            d="M4 5.5A1.5 1.5 0 0 1 5.5 4H9a2 2 0 0 1 2 2v12a1.5 1.5 0 0 0-1.5-1.5h-4A1.5 1.5 0 0 1 4 15V5.5Z"
            fill="currentColor"
            opacity="0.55"
          />
          <path
            d="M20 5.5A1.5 1.5 0 0 0 18.5 4H15a2 2 0 0 0-2 2v12a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 0 20 15V5.5Z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="text-lg">Cram</span>
    </Link>
  );
}
