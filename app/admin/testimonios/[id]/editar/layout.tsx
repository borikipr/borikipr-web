import type { ReactNode } from "react";
import { requireModulePageAccess } from "@/lib/admin/page-access";

export default async function EditTestimonialLayout({ children }: { children: ReactNode }) {
  await requireModulePageAccess("testimonials", "manage");
  return children;
}
