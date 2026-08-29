import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";
export default async function LeadGroupsLayout({ children }: { children: ReactNode }) { await requireModulePageAccess("leads"); return children; }
