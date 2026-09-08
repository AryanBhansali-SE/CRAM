import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/AuthForm";
import { googleAuthEnabled, safeNextParam } from "@/lib/auth-shared";

export const metadata: Metadata = {
  title: "Create an account",
  description: "Create a Cram account and start studying from your own materials.",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;

  return (
    <AuthForm
      mode="signup"
      next={safeNextParam(params.next)}
      initialError={params.error}
      googleEnabled={googleAuthEnabled()}
    />
  );
}
