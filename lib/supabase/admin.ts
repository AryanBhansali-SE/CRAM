import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

/**
 * Service-role client. Bypasses Row Level Security completely, so it is only
 * for genuine administrative work with no user in the request path.
 *
 * Nothing in the request flow uses this today — upload, query, and delete all
 * run as the signed-in user so RLS stays in force. Kept as a single, obvious
 * place for future admin tasks (backfills, cleanup jobs) rather than something
 * routes reach for by habit.
 */
export function createAdminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
