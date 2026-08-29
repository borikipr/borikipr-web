import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";

export default async function NewTestimonialLayout({ children }: { children: ReactNode }) {
  await requireModulePageAccess("testimonials", "manage");
  return children;
}
