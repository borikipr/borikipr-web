import { notFound, redirect } from "next/navigation";
import { AdminAccessError, requireSuperAdmin } from "@/lib/admin/access-context";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function EditTeamMemberPage({ params }: { params: Promise<{ userId: string }> }) {
  let access;
  try { access = await requireSuperAdmin(); } catch (error) { if (error instanceof AdminAccessError && error.code === "unauthenticated") redirect("/admin/login"); redirect("/admin"); }
  const { userId } = await params;
  if (!UUID_PATTERN.test(userId) || access.user.id === userId) notFound();
  redirect(`/admin/equipo/${userId}/perfil-profesional`);
}
