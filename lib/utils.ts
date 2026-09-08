/** Join conditional class names. Keeps component markup readable. */
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** "Syllabus_Week_1.pdf" -> "Syllabus Week 1" for friendlier display. */
export function prettyFilename(filename: string): string {
  return filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ");
}

export function formatCount(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
