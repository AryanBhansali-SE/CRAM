import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Request-scoped Supabase client for Server Components, Route Handlers, and
 * Server Actions. It carries the visitor's session cookies, so every query runs
 * as that user and Row Level Security applies.
 *
 * This is the client API routes should use — not a service-role client, which
 * would bypass RLS entirely.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Components can't set cookies. Harmless: proxy.ts refreshes
            // the session on every request, so the tokens stay current.
          }
        },
      },
    }
  );
}
