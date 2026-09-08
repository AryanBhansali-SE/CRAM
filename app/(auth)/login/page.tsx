import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { googleAuthEnabled, safeNextParam } from "@/lib/auth-shared";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your Cram workspace.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthForm
      mode="login"
      next={safeNextParam(params.next)}
      initialError={params.error}
      googleEnabled={googleAuthEnabled()}
    />
  );
}
