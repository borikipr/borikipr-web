import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function SignatureGovernanceManagementPage() {
  if (!(await getAdminSession())) redirect("/admin/login");
  redirect("/admin/signatures/gobernanza");
}
