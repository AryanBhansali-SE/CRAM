import type { ReactNode } from "react";
import { WorkspaceHeader } from "@/components/workspace/WorkspaceHeader";
import { requireUser } from "@/lib/auth";

/**
 * Shell for the signed-in product. Everything in this route group is gated
 * here, in addition to the check in proxy.ts — the proxy handles the redirect
 * cheaply, and this makes the guarantee hold even if the matcher ever changes.
 */
export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const user = await requireUser("/workspace");

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <WorkspaceHeader user={{ id: user.id, email: user.email ?? null }} />
      {children}
    </div>
  );
}
