import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";

export default async function NewSignatureLayout({ children }: { children: ReactNode }) {
  await requireModulePageAccess("signatures", "manage");
  return children;
}
