import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";
export default async function AnalyticsLayout({ children }: { children: ReactNode }) { await requireModulePageAccess("analytics"); return children; }
