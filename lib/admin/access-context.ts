import "server-only";

import { cache } from "react";
import { getAdminSession, type AdminSessionUser } from "@/lib/admin/auth";
import {
  hasMinimumAccess,
  type AccessLevel,
  type AccountState,
  type ModuleKey,
  type SystemRole,
} from "@/lib/admin/access-types";
import { sql } from "@/lib/db";

export type AdminAccessContext = Readonly<{
  user: AdminSessionUser;
  systemRole: SystemRole;
  accountState: AccountState;
  moduleAccess: ReadonlyMap<ModuleKey, AccessLevel>;
  isSuperAdmin: boolean;
  isAdminBaseline: boolean;
}>;

export class AdminAccessError extends Error {
  constructor(public readonly code: "unauthenticated" | "forbidden") {
    super(code);
  }
}

type AccessRow = {
  system_role: SystemRole;
  account_state: AccountState;
  module_key: ModuleKey | null;
  access_level: AccessLevel | null;
};

export const getAdminAccessContext = cache(async (): Promise<AdminAccessContext | null> => {
  const user = await getAdminSession();
  if (!user) return null;

  const rows = await sql<AccessRow[]>`
    SELECT admin.system_role, admin.account_state, module_access.module_key, module_access.access_level
      FROM public.admin_users admin
      LEFT JOIN public.admin_module_access module_access
        ON module_access.admin_user_id = admin.id
     WHERE admin.id = ${user.id}::uuid
       AND admin.activo = true
       AND admin.account_state = 'active'
  `;
  const first = rows[0];
  if (!first) return null;
  const moduleAccess = new Map<ModuleKey, AccessLevel>();
  for (const row of rows) {
    if (row.module_key && row.access_level) moduleAccess.set(row.module_key, row.access_level);
  }
  return {
    user,
    systemRole: first.system_role,
    accountState: first.account_state,
    moduleAccess,
    isSuperAdmin: first.system_role === "super_admin",
    isAdminBaseline: first.system_role === "super_admin" || first.system_role === "admin",
  };
});

export async function requireAdminAccess() {
  const context = await getAdminAccessContext();
  if (!context) throw new AdminAccessError("unauthenticated");
  return context;
}

export async function requireSuperAdmin() {
  const context = await requireAdminAccess();
  if (!context.isSuperAdmin) throw new AdminAccessError("forbidden");
  return context;
}

export async function requireModuleAccess(
  moduleKey: ModuleKey,
  minimumLevel: AccessLevel = "view",
) {
  const context = await requireAdminAccess();
  if (context.isAdminBaseline) return context;
  if (!hasMinimumAccess(context.moduleAccess.get(moduleKey), minimumLevel)) {
    throw new AdminAccessError("forbidden");
  }
  return context;
}
