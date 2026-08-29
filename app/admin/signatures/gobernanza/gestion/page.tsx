import { redirect } from "next/navigation";
import { requireAdminBaseline } from "@/lib/admin/access-context";

export const dynamic = "force-dynamic";

export default async function SignatureGovernanceManagementPage() {
  try { await requireAdminBaseline(); } catch { redirect("/admin/sin-acceso"); }
  redirect("/admin/signatures/gobernanza");
}
