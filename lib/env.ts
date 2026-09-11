/**
 * Environment access that fails loudly.
 *
 * The alternative is `process.env.X!`, which types as a string and is `undefined`
 * at runtime — so a missing variable surfaces much later as "Invalid URL" or a
 * 401 from an API, somewhere with no hint about which key is missing. On a fresh
 * deployment that is the single most likely thing to be wrong, so it's worth
 * saying plainly.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example — in production set it under Vercel → Settings → Environment Variables and redeploy.`
    );
  }
  return value.trim();
}

/** True when the variable is present and non-empty. */
export function hasEnv(name: string): boolean {
  return !!process.env[name]?.trim();
}
