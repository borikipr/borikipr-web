import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";

export default async function UseSignatureTemplateLayout({ children }: { children: ReactNode }) {
  await requireModulePageAccess("signatures", "manage");
  return children;
}
