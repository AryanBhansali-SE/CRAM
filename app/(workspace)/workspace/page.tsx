import type { Metadata } from "next";
import { Workspace } from "@/components/workspace/Workspace";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Upload your course materials and ask questions across all of them.",
};

export default function WorkspacePage() {
  return <Workspace />;
}
