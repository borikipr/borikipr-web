import { redirect } from "next/navigation";

export default async function LegacyLeadGroupDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/admin/leads/casos/${id}`);
}
