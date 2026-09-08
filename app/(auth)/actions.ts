"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { anonymousTrialEnabled } from "@/lib/auth-shared";

export type AuthState = {
  error?: string;
  /** Set when sign-up succeeded but the account still needs email confirmation. */
  notice?: string;
};

/**
 * Only ever redirect to a path on this site. Without this check, a crafted
 * ?next=https://evil.example link would turn login into an open redirect.
 */
function safeNext(value: FormStateValue): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/workspace";
}

type FormStateValue = FormDataEntryValue | null;

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
    next: safeNext(formData.get("next")),
  };
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Supabase deliberately keeps this vague so the form can't be used to test
    // which addresses have accounts.
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = readCredentials(formData);

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }

  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm?next=${encodeURIComponent(next)}` },
  });

  if (error) {
    return { error: error.message };
  }

  // With email confirmation switched on, sign-up returns a user but no session.
  // Sending them to the workspace would just bounce them back to login, so show
  // the check-your-inbox state instead.
  if (!data.session) {
    return {
      notice: `Almost there — we sent a confirmation link to ${email}. Click it to finish setting up your account.`,
    };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const origin = (await headers()).get("origin") ?? "";

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "Google sign-in is unavailable.")}`);
  }

  redirect(data.url);
}

/**
 * Starts the anonymous preview.
 *
 * signInAnonymously mints a real row in auth.users with is_anonymous set, so the
 * visitor gets a genuine auth.uid() and every existing RLS policy covers their
 * uploads unchanged — no service-role writes, no client-supplied identifier to
 * forge. The tier logic reads is_anonymous to cap them at the trial allowance.
 */
export async function startTrial(): Promise<void> {
  if (!anonymousTrialEnabled()) {
    redirect("/signup");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously();

  if (error) {
    // Almost always anonymous_provider_disabled — the project toggle is off.
    // Sending them to sign-up is a working path, not a dead end.
    console.error("Anonymous trial sign-in failed:", error.message);
    redirect("/signup?error=" + encodeURIComponent("Preview is unavailable — create a free account instead."));
  }

  revalidatePath("/", "layout");
  redirect("/workspace");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
