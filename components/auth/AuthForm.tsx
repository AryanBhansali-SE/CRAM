"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  login as loginAction,
  signup as signupAction,
  signInWithGoogle as googleAction,
  type AuthState,
} from "@/app/(auth)/actions";

type Mode = "login" | "signup";

const copy = {
  login: {
    title: "Welcome back",
    subtitle: "Pick up where you left off.",
    submit: "Sign in",
    altPrompt: "New to Cram?",
    altLabel: "Create an account",
    altHref: "/signup",
    passwordHint: undefined,
    autoComplete: "current-password",
  },
  signup: {
    title: "Create your account",
    subtitle: "Upload your materials and start asking questions.",
    submit: "Create account",
    altPrompt: "Already have an account?",
    altLabel: "Sign in",
    altHref: "/login",
    passwordHint: "At least 8 characters.",
    autoComplete: "new-password",
  },
} as const;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="lg" className="w-full" disabled={pending}>
      {pending ? (
        <>
          <Spinner className="size-4" />
          Just a moment…
        </>
      ) : (
        label
      )}
    </Button>
  );
}

const fieldClass =
  "w-full rounded-xl border border-border-base bg-surface px-3.5 py-2.5 text-sm text-foreground transition-colors placeholder:text-foreground-subtle focus:border-brand-400 focus:outline-none";

export function AuthForm({
  mode,
  next,
  initialError,
  googleEnabled,
}: {
  mode: Mode;
  next: string;
  initialError?: string;
  googleEnabled: boolean;
}) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction] = useActionState<AuthState, FormData>(action, {
    error: initialError,
  });
  const t = copy[mode];

  // The confirmation notice replaces the form — there's nothing left to fill in.
  if (state.notice) {
    return (
      <div className="animate-fade-up text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
          <svg viewBox="0 0 24 24" fill="none" className="size-6" aria-hidden>
            <path
              d="M4 7.5 12 13l8-5.5M5.5 5.5h13A1.5 1.5 0 0 1 20 7v10a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17V7a1.5 1.5 0 0 1 1.5-1.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <h2 className="mt-4 text-xl font-semibold tracking-tight">Check your inbox</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground-muted">{state.notice}</p>
        <Link
          href="/login"
          className="mt-6 inline-block text-sm font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-2 text-sm text-foreground-muted">{t.subtitle}</p>
      </div>

      {state.error && (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm leading-relaxed text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {state.error}
        </p>
      )}

      {googleEnabled && (
        <>
          <form action={googleAction} className="mt-6">
            <input type="hidden" name="next" value={next} />
            <Button type="submit" variant="secondary" size="lg" className="w-full">
              <svg viewBox="0 0 24 24" className="size-4.5" aria-hidden>
                <path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.45a5.5 5.5 0 0 1-2.4 3.6v3h3.87c2.27-2.09 3.58-5.17 3.58-8.63Z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z" />
                <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l4-3.1Z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.95 1.17 15.23 0 12 0A12 12 0 0 0 1.27 6.62l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
              </svg>
              Continue with Google
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs text-foreground-subtle">or</span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>
        </>
      )}

      <form action={formAction} className={googleEnabled ? "space-y-4" : "mt-6 space-y-4"}>
        <input type="hidden" name="next" value={next} />

        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@university.edu"
            className={fieldClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={mode === "signup" ? 8 : undefined}
            autoComplete={t.autoComplete}
            placeholder="••••••••"
            className={fieldClass}
          />
          {t.passwordHint && (
            <p className="mt-1.5 text-xs text-foreground-subtle">{t.passwordHint}</p>
          )}
        </div>

        <SubmitButton label={t.submit} />
      </form>

      <p className="mt-6 text-center text-sm text-foreground-muted">
        {t.altPrompt}{" "}
        <Link
          href={t.altHref}
          className="font-medium text-brand-600 hover:underline dark:text-brand-300"
        >
          {t.altLabel}
        </Link>
      </p>
    </div>
  );
}
