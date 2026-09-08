import "server-only";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side identity. Every one of these reads the session from the request's
 * cookies and validates it with Supabase — a user id sent by the client is
 * never trusted.
 *
 * `getUser()` calls supabase.auth.getUser(), which verifies the JWT against the
 * auth server. Never swap it for getSession(), which only decodes the cookie
 * and would accept a forged one.
 */
export async function getUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** The signed-in user's id, or null when signed out. */
export async function getUserId(): Promise<string | null> {
  const user = await getUser();
  return user?.id ?? null;
}

/**
 * For pages: guarantees a user or redirects to login. Route handlers should use
 * `getUser()` and return 401 instead, so callers get an error rather than HTML.
 */
export async function requireUser(nextPath?: string): Promise<User> {
  const user = await getUser();
  if (!user) {
    const target = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login";
    redirect(target);
  }
  return user;
}
