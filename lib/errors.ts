/**
 * Turning raw failures into something a student can act on.
 *
 * The upstream errors here are unhelpful by default — a Gemini rate limit
 * arrives as a JSON blob with code 429 buried in it, and pdf2json throws
 * "Invalid XRef stream". Neither belongs in front of a user, but the
 * distinction between "try again" and "this will never work" very much does.
 */

export type FailureKind =
  | "rate_limited"
  | "upstream_unavailable"
  | "misconfigured"
  | "unreadable_file"
  | "too_large"
  | "unsupported_type"
  | "unknown";

export type Failure = {
  kind: FailureKind;
  /** Shown to the user verbatim. */
  message: string;
  /** Whether trying the same thing again could plausibly work. */
  retryable: boolean;
  status: number;
};

function textOf(err: unknown): string {
  if (err instanceof Error) return `${err.message} ${"cause" in err ? String(err.cause ?? "") : ""}`;
  return String(err);
}

/** Rate limits and 5xx — worth another attempt. A bad key or bad input is not. */
export function isTransient(err: unknown): boolean {
  const text = textOf(err);
  return (
    /\b(429|500|502|503|504)\b/.test(text) ||
    /UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|INTERNAL|ECONNRESET|ETIMEDOUT|fetch failed/i.test(
      text
    )
  );
}

export function describeFailure(err: unknown): Failure {
  const text = textOf(err);

  if (/\b429\b|RESOURCE_EXHAUSTED|rate.?limit|quota/i.test(text)) {
    return {
      kind: "rate_limited",
      message:
        "Cram is handling a lot of requests right now. Give it a moment and try again — your allowance wasn't used.",
      retryable: true,
      status: 429,
    };
  }

  if (/\b(500|502|503|504)\b|UNAVAILABLE|DEADLINE_EXCEEDED|INTERNAL|fetch failed|ECONNRESET/i.test(text)) {
    return {
      kind: "upstream_unavailable",
      message: "That took too long or the service hiccuped. Try again in a moment.",
      retryable: true,
      status: 503,
    };
  }

  if (/API key|PERMISSION_DENIED|UNAUTHENTICATED|\b401\b|\b403\b/i.test(text)) {
    return {
      kind: "misconfigured",
      message:
        "Cram isn't configured correctly on the server, so it can't process that right now. This one's on us.",
      retryable: false,
      status: 500,
    };
  }

  if (/XRef|Invalid PDF|PDF header|pdfParser|password|encrypted/i.test(text)) {
    return {
      kind: "unreadable_file",
      message:
        "That PDF couldn't be read — it may be password-protected, or a scan with no selectable text.",
      retryable: false,
      status: 400,
    };
  }

  if (/No text found|No readable text/i.test(text)) {
    return {
      kind: "unreadable_file",
      message:
        "No selectable text in that PDF. If it's a scan or photos, it needs to be run through OCR first.",
      retryable: false,
      status: 400,
    };
  }

  if (/Failed to parse body as FormData|body exceeded|PayloadTooLarge|too large/i.test(text)) {
    return {
      kind: "too_large",
      message: "That file is too large to upload. Try one under 4MB, or split it into sections.",
      retryable: false,
      status: 413,
    };
  }

  return {
    kind: "unknown",
    message: err instanceof Error ? err.message : String(err),
    retryable: false,
    status: 500,
  };
}
