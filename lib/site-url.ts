/**
 * The canonical origin for links that come back to us — email confirmation and
 * the OAuth callback.
 *
 * Order matters. NEXT_PUBLIC_SITE_URL wins because these URLs have to match what
 * is allowlisted under Supabase → Authentication → URL Configuration, and a
 * preview deployment's own hostname won't be on that list — a confirmation email
 * sent from a preview would land on a URL Supabase refuses. Falling back to the
 * request's Origin header is what makes local development work with no config.
 */
export function resolveSiteUrl(requestOrigin: string | null): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");

  // Set by Vercel to the stable production hostname, on every deployment.
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (production) return `https://${production}`;

  return (requestOrigin || "http://localhost:3000").replace(/\/+$/, "");
}
