/**
 * Auth helpers with no server-only dependencies, so they can be imported from
 * pages, route handlers, and client components alike.
 */

/** Guards against open redirects: only same-site paths are accepted. */
export function safeNextParam(value: string | undefined): string {
  if (!value) return "/workspace";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/workspace";
}

/**
 * Google sign-in needs a client ID and secret configured on the Supabase
 * project itself. Until that's done the provider returns an error, so the
 * button stays hidden behind this flag rather than showing a dead control.
 */
export function googleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true";
}

/**
 * Where the marketing CTAs should point. Signed-in visitors go straight to the
 * workspace; everyone else lands in the auth flow rather than a gated page they
 * would just be bounced out of.
 */
export function startHref(authed: boolean): string {
  return authed ? "/workspace" : "/signup";
}

export function openHref(authed: boolean): string {
  return authed ? "/workspace" : "/login";
}
