import { createBrowserClient } from "@supabase/ssr";
import { requireEnv } from "@/lib/env";

/**
 * Browser-side Supabase client. Uses the publishable (anon) key, which is safe
 * to ship to the browser — every request it makes is still subject to Row Level
 * Security. The service-role key must never be used here.
 */
export function createClient() {
  return createBrowserClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
  );
}
