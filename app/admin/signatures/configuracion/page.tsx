import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";

export default async function SignatureSettingsPage() {
  if (!(await getAdminSessionUser())) redirect("/admin/login");
  redirect("/admin/signatures");
}
