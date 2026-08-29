import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";
export default async function PropertiesLayout({ children }: { children: ReactNode }) { await requireModulePageAccess("properties"); return children; }
