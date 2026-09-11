/**
 * Upload rules shared by the browser and the route.
 *
 * Both ends check the same things: the client so the user hears about a problem
 * instantly and we don't waste a round trip, the server because the client's
 * check is advisory and a direct POST bypasses it entirely. One definition here
 * keeps the two from drifting into contradicting each other.
 */

/**
 * Largest file we accept.
 *
 * The hard constraint is the request-body ceiling — roughly 10MB on this
 * runtime, 4.5MB on Vercel serverless — so 4MB stays comfortably under both
 * wherever it's deployed. A 50-100 page text PDF is typically 1-3MB. What
 * exceeds this is scans and image-heavy decks, which have no selectable text
 * and need OCR before Cram could read them anyway.
 */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;

export function megabytes(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export function looksLikePdf(file: { name: string; type?: string }): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export function tooLargeMessage(file: { name: string; size: number }): string {
  return `${file.name} is ${megabytes(file.size)} — the limit is ${megabytes(MAX_FILE_BYTES)} per file. Try splitting it into chapters.`;
}

export function notPdfMessage(file: { name: string }): string {
  return `${file.name} isn't a PDF. Export or print it to PDF and try again.`;
}
