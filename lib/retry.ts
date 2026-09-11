import { isTransient } from "./errors";

/**
 * Retries a call that failed for a reason worth repeating.
 *
 * The upstream model returns 503 "experiencing high demand" often enough that a
 * single attempt is not a reliable way to answer a question — it showed up twice
 * in one test run. A rate limit or a brief spike clears in well under a second;
 * a bad request or a bad key never will, so only transient failures are retried.
 *
 * This wraps the call. It does not change the model, the client, or any
 * generation parameters.
 */
export async function withRetry<T>(
  call: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 400
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await call();
    } catch (err) {
      if (attempt >= attempts - 1 || !isTransient(err)) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** attempt));
    }
  }
}
