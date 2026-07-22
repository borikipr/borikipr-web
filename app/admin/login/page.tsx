import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin/auth";
import LoginForm from "./LoginForm";

export default async function AdminLoginPage() {
  if (await getAdminSession()) redirect("/admin");
  return <LoginForm />;
}
