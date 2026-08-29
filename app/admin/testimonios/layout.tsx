import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";
export default async function TestimonialsLayout({ children }: { children: ReactNode }) { await requireModulePageAccess("testimonials"); return children; }
