"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import {
  addLeadGroupMemberInTransaction,
  addLeadGroupNoteInTransaction,
  createLeadGroupInTransaction,
  removeLeadGroupMemberInTransaction,
  updateLeadGroupInTransaction,
} from "@/lib/admin/lead-group-mutations";
import {
  LEAD_GROUP_ROLE_LABELS,
  LEAD_GROUP_STATUS_LABELS,
  type LeadGroupRole,
  type LeadGroupStatus,
} from "@/lib/admin/queries/lead-groups";
import { sql } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const username = await getAdminSessionUser();
  if (!username) redirect("/admin/login");
  return username;
}

function uuid(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (!UUID_PATTERN.test(value)) throw new Error("Identificador inválido.");
  return value;
}

function role(formData: FormData, field = "role") {
  const value = String(formData.get(field) ?? "") as LeadGroupRole;
  if (!(value in LEAD_GROUP_ROLE_LABELS)) throw new Error("Función inválida.");
  return value;
}

function groupHref(groupId: string, message: string) {
  return `/admin/lead-groups/${groupId}?ok=${encodeURIComponent(message)}`;
}

function safeFailureHref(groupId: string | null, kind = "rolled_back") {
  return groupId ? `/admin/lead-groups/${groupId}?group_result=${kind}` : `/admin/lead-groups?group_result=${kind}`;
}

export async function createLeadGroupAction(formData: FormData) {
  const username = await requireAdmin();
  const sourceLeadId = uuid(formData, "source_lead_id");
  const operationKey = uuid(formData, "operation_key");
  const title = String(formData.get("title") ?? "").trim();
  if (!title || title.length > 200) redirect(`/admin/leads/${sourceLeadId}?group_result=invalid`);
  const rawProperty = String(formData.get("primary_property_id") ?? "").trim();
  const primaryPropertyId = rawProperty ? uuid(formData, "primary_property_id") : null;
  const selectedIds = [...new Set(formData.getAll("member_id").map(String))];
  if (!selectedIds.includes(sourceLeadId)) selectedIds.unshift(sourceLeadId);
  if (selectedIds.some((id) => !UUID_PATTERN.test(id)) || selectedIds.length < 2) {
    redirect(`/admin/leads/${sourceLeadId}?group_result=invalid`);
  }
  const primaryContactLeadId = uuid(formData, "primary_contact_lead_id");
  if (!selectedIds.includes(primaryContactLeadId)) redirect(`/admin/leads/${sourceLeadId}?group_result=invalid`);
  const members = selectedIds.map((leadId) => ({
    leadId,
    role: role(formData, `role_${leadId}`),
    isPrimaryContact: leadId === primaryContactLeadId,
  }));

  let result;
  try {
    result = await sql.begin(async (transaction) => {
      const relatedIds = selectedIds.filter((id) => id !== sourceLeadId);
      const allowed = await transaction.unsafe<Array<{ count: number }>>(
        `SELECT count(DISTINCT CASE WHEN lead_id=$1::uuid THEN related_lead_id ELSE lead_id END)::int AS count
        FROM public.lead_relationships
        WHERE (lead_id=$1::uuid AND related_lead_id=ANY($2::uuid[]))
           OR (related_lead_id=$1::uuid AND lead_id=ANY($2::uuid[]))`,
        [sourceLeadId, relatedIds]
      );
      if (allowed[0].count !== relatedIds.length) throw new Error("Relación no confirmada.");
      return createLeadGroupInTransaction(transaction, {
        title, primaryPropertyId, members, actorUsername: username, operationKey,
      });
    });
  } catch {
    redirect(`/admin/leads/${sourceLeadId}?group_result=rolled_back`);
  }
  revalidatePath("/admin/leads");
  revalidatePath("/admin/lead-groups");
  revalidatePath(`/admin/leads/${sourceLeadId}`);
  redirect(groupHref(result.groupId, result.status === "existing" ? "El caso ya existía" : "Caso compartido creado"));
}

export async function addLeadGroupMemberAction(formData: FormData) {
  const username = await requireAdmin();
  const groupId = uuid(formData, "group_id");
  const leadId = uuid(formData, "lead_id");
  const operationKey = uuid(formData, "operation_key");
  let result;
  try {
    result = await sql.begin((transaction) => addLeadGroupMemberInTransaction(transaction, {
      groupId, leadId, role: role(formData), actorUsername: username, operationKey,
    }));
  } catch {
    redirect(safeFailureHref(groupId));
  }
  revalidatePath(`/admin/lead-groups/${groupId}`);
  revalidatePath("/admin/lead-groups");
  revalidatePath("/admin/leads");
  redirect(groupHref(groupId, result.status === "existing" ? "La persona ya pertenece al caso" : "Persona añadida"));
}

export async function removeLeadGroupMemberAction(formData: FormData) {
  const username = await requireAdmin();
  const groupId = uuid(formData, "group_id");
  const leadId = uuid(formData, "lead_id");
  const operationKey = uuid(formData, "operation_key");
  try {
    await sql.begin((transaction) => removeLeadGroupMemberInTransaction(transaction, {
      groupId, leadId, actorUsername: username, operationKey,
    }));
  } catch {
    redirect(safeFailureHref(groupId));
  }
  revalidatePath(`/admin/lead-groups/${groupId}`);
  revalidatePath("/admin/lead-groups");
  revalidatePath("/admin/leads");
  redirect(groupHref(groupId, "Persona removida del caso"));
}

export async function addLeadGroupNoteAction(formData: FormData) {
  const username = await requireAdmin();
  const groupId = uuid(formData, "group_id");
  const operationKey = uuid(formData, "operation_key");
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 5000) redirect(safeFailureHref(groupId, "invalid"));
  try {
    await sql.begin((transaction) => addLeadGroupNoteInTransaction(transaction, {
      groupId, body, actorUsername: username, operationKey,
    }));
  } catch {
    redirect(safeFailureHref(groupId));
  }
  revalidatePath(`/admin/lead-groups/${groupId}`);
  redirect(groupHref(groupId, "Nota compartida guardada"));
}

export async function updateLeadGroupAction(formData: FormData) {
  const username = await requireAdmin();
  const groupId = uuid(formData, "group_id");
  const operationKey = uuid(formData, "operation_key");
  const intent = String(formData.get("intent") ?? "");
  const input: Parameters<typeof updateLeadGroupInTransaction>[1] = {
    groupId, actorUsername: username, operationKey,
  };
  if (intent === "status") {
    const status = String(formData.get("status") ?? "") as LeadGroupStatus;
    if (!(status in LEAD_GROUP_STATUS_LABELS)) redirect(safeFailureHref(groupId, "invalid"));
    input.status = status;
  } else if (intent === "follow_up") {
    const raw = String(formData.get("next_follow_up_at") ?? "").trim();
    if (raw && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) redirect(safeFailureHref(groupId, "invalid"));
    input.nextFollowUpAt = raw ? new Date(`${raw}:00-04:00`).toISOString() : null;
  } else if (intent === "contacted") {
    input.markContacted = true;
  } else {
    redirect(safeFailureHref(groupId, "invalid"));
  }
  try {
    await sql.begin((transaction) => updateLeadGroupInTransaction(transaction, input));
  } catch {
    redirect(safeFailureHref(groupId));
  }
  revalidatePath(`/admin/lead-groups/${groupId}`);
  revalidatePath("/admin/lead-groups");
  revalidatePath("/admin/leads/seguimientos");
  redirect(groupHref(groupId, "Caso actualizado"));
}
