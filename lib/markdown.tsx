import type { ReactNode } from "react";

/**
 * A deliberately small markdown renderer for assistant answers.
 *
 * Gemini replies in light markdown — bold, bullets, numbered steps, inline code.
 * Rendering those as React nodes (never raw HTML) keeps the output safe while
 * avoiding a full markdown dependency for four constructs.
 */

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`)/g;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text
    .split(INLINE)
    .filter((part) => part !== "")
    .map((part, i) => {
      const key = `${keyPrefix}-${i}`;
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={key} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("`") && part.endsWith("`")) {
        return (
          <code
            key={key}
            className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em] text-brand-700 dark:text-brand-300"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      return <span key={key}>{part}</span>;
    });
}

type Block =
  | { type: "p"; lines: string[] }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "h"; text: string };

const BULLET = /^\s*[-*•]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

function toBlocks(source: string): Block[] {
  const blocks: Block[] = [];

  for (const rawLine of source.split("\n")) {
    const line = rawLine.trimEnd();
    const last = blocks[blocks.length - 1];

    if (!line.trim()) {
      // Blank line closes the current block.
      if (last && last.type === "p") blocks.push({ type: "p", lines: [] });
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      blocks.push({ type: "h", text: heading[1] });
      continue;
    }

    const bullet = line.match(BULLET);
    if (bullet) {
      if (last && last.type === "ul") last.items.push(bullet[1]);
      else blocks.push({ type: "ul", items: [bullet[1]] });
      continue;
    }

    const numbered = line.match(NUMBERED);
    if (numbered) {
      if (last && last.type === "ol") last.items.push(numbered[1]);
      else blocks.push({ type: "ol", items: [numbered[1]] });
      continue;
    }

    if (last && last.type === "p" && last.lines.length > 0) last.lines.push(line);
    else blocks.push({ type: "p", lines: [line] });
  }

  return blocks.filter((b) => b.type !== "p" || b.lines.length > 0);
}

export function Markdown({ content }: { content: string }) {
  const blocks = toBlocks(content);

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        if (block.type === "h") {
          return (
            <h4 key={i} className="font-semibold tracking-tight text-foreground">
              {renderInline(block.text, `h${i}`)}
            </h4>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="ml-1 space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
                  <span>{renderInline(item, `ul${i}-${j}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ol") {
          return (
            <ol key={i} className="ml-1 space-y-1.5">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-2.5">
                  <span className="mt-px w-4 shrink-0 text-xs font-semibold text-brand-500">
                    {j + 1}.
                  </span>
                  <span>{renderInline(item, `ol${i}-${j}`)}</span>
                </li>
              ))}
            </ol>
          );
        }
        return <p key={i}>{renderInline(block.lines.join(" "), `p${i}`)}</p>;
      })}
    </div>
  );
}
