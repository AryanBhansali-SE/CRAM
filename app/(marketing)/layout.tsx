import type { ReactNode } from "react";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { getUser } from "@/lib/auth";

/** Public marketing shell: anything in this group is visible logged-out. */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const user = await getUser();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader user={user ? { id: user.id, email: user.email ?? null } : null} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
