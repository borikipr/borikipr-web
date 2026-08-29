import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";

export default async function NewPropertyLayout({ children }: { children: ReactNode }) {
  await requireModulePageAccess("properties", "manage");
  return children;
}
