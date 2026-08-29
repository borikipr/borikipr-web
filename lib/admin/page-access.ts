import "server-only";

import { redirect } from "next/navigation";
import { AdminAccessError, requireModuleAccess } from "@/lib/admin/access-context";
import type { AccessLevel, ModuleKey } from "@/lib/admin/access-types";

export async function requireModulePageAccess(moduleKey: ModuleKey, level: AccessLevel = "view") {
  try {
    return await requireModuleAccess(moduleKey, level);
  } catch (error) {
    if (error instanceof AdminAccessError && error.code === "unauthenticated") redirect("/admin/login");
    redirect("/admin/sin-acceso");
  }
}
