import type { TransactionSql } from "postgres";
import type { LeadGroupRole, LeadGroupStatus } from "@/lib/admin/queries/lead-groups";

type GroupMemberInput = {
  leadId: string;
  role: LeadGroupRole;
  isPrimaryContact: boolean;
};

type CreateGroupInput = {
  title: string;
  primaryPropertyId: string | null;
  status?: LeadGroupStatus;
  nextFollowUpAt?: string | null;
  members: GroupMemberInput[];
  actorUsername: string;
  operationKey: string;
};

async function existingOperation(transaction: TransactionSql, operationKey: string) {
  const rows = await transaction.unsafe<Array<{ group_id: string }>>(
    `SELECT group_id::text FROM public.lead_group_events
    WHERE idempotency_key=$1::uuid`, [operationKey]
  );
  return rows[0]?.group_id ?? null;
}

async function lockGroup(transaction: TransactionSql, groupId: string, allowArchived = false) {
  const rows = await transaction.unsafe<Array<{ id: string; status: LeadGroupStatus }>>(
    `SELECT id::text, status FROM public.lead_groups WHERE id=$1::uuid FOR UPDATE`, [groupId]
  );
  if (!rows[0] || (!allowArchived && rows[0].status === "archived")) throw new Error("Caso no disponible.");
  return rows[0];
}

async function lockActiveLeads(transaction: TransactionSql, leadIds: string[]) {
  const ordered = [...new Set(leadIds)].sort();
  const rows = await transaction.unsafe<Array<{ id: string }>>(
    `SELECT id::text FROM public.leads
    WHERE id=ANY($1::uuid[]) AND merged_into_lead_id IS NULL
    ORDER BY id FOR UPDATE`, [ordered]
  );
  if (rows.length !== ordered.length) throw new Error("Una persona ya no está disponible.");
}

async function recordEvent(
  transaction: TransactionSql,
  input: { groupId: string; eventType: string; eventDataJson: string; actorUsername: string; operationKey: string }
) {
  await transaction.unsafe(
    `INSERT INTO public.lead_group_events (
      group_id, event_type, event_data, actor_username, idempotency_key
    ) VALUES ($1::uuid, $2::text, $3::text::jsonb, $4, $5::uuid)`,
    [input.groupId, input.eventType, input.eventDataJson, input.actorUsername, input.operationKey]
  );
}

export async function createLeadGroupInTransaction(
  transaction: TransactionSql,
  input: CreateGroupInput
) {
  const appliedGroupId = await existingOperation(transaction, input.operationKey);
  if (appliedGroupId) return { groupId: appliedGroupId, status: "existing" as const };
  const members = [...new Map(input.members.map((member) => [member.leadId, member])).values()];
  if (members.length < 2 || members.filter((member) => member.isPrimaryContact).length !== 1) {
    throw new Error("El caso requiere dos personas y un contacto principal.");
  }
  await lockActiveLeads(transaction, members.map((member) => member.leadId));
  if (input.primaryPropertyId) {
    const properties = await transaction.unsafe<Array<{ id: string }>>(
      "SELECT id::text FROM public.propiedades WHERE id=$1::uuid FOR SHARE",
      [input.primaryPropertyId]
    );
    if (!properties[0]) throw new Error("Propiedad no disponible.");
  }
  const groups = await transaction.unsafe<Array<{ id: string }>>(
    `INSERT INTO public.lead_groups (
      title, status, primary_property_id, next_follow_up_at, created_by
    ) VALUES ($1, $2::text, $3::uuid, $4::timestamptz, $5) RETURNING id::text`,
    [input.title, input.status ?? "new", input.primaryPropertyId, input.nextFollowUpAt ?? null, input.actorUsername]
  );
  const groupId = groups[0].id;
  for (const member of members) {
    await transaction.unsafe(
      `INSERT INTO public.lead_group_members (
        group_id, lead_id, role, is_primary_contact, created_by
      ) VALUES ($1::uuid, $2::uuid, $3::text, $4::boolean, $5)`,
      [groupId, member.leadId, member.role, member.isPrimaryContact, input.actorUsername]
    );
  }
  const primary = members.find((member) => member.isPrimaryContact) as GroupMemberInput;
  await recordEvent(transaction, {
    groupId,
    eventType: "group_created",
    eventDataJson: JSON.stringify({ memberCount: members.length, primaryContactLeadId: primary.leadId }),
    actorUsername: input.actorUsername,
    operationKey: input.operationKey,
  });
  return { groupId, status: "created" as const };
}

export async function addLeadGroupMemberInTransaction(
  transaction: TransactionSql,
  input: { groupId: string; leadId: string; role: LeadGroupRole; actorUsername: string; operationKey: string }
) {
  const applied = await existingOperation(transaction, input.operationKey);
  if (applied) return { status: "existing" as const };
  await lockGroup(transaction, input.groupId);
  await lockActiveLeads(transaction, [input.leadId]);
  const related = await transaction.unsafe<Array<{ ok: boolean }>>(
    `SELECT EXISTS (
      SELECT 1 FROM public.lead_group_members gm
      JOIN public.lead_relationships lr ON (
        (lr.lead_id=gm.lead_id AND lr.related_lead_id=$2::uuid)
        OR (lr.related_lead_id=gm.lead_id AND lr.lead_id=$2::uuid)
      )
      WHERE gm.group_id=$1::uuid AND gm.removed_at IS NULL
    ) AS ok`, [input.groupId, input.leadId]
  );
  if (!related[0]?.ok) throw new Error("La persona debe tener una relación confirmada con el caso.");
  const rows = await transaction.unsafe<Array<{ removed_at: string | Date | null }>>(
    `SELECT removed_at FROM public.lead_group_members
    WHERE group_id=$1::uuid AND lead_id=$2::uuid FOR UPDATE`, [input.groupId, input.leadId]
  );
  if (rows[0] && !rows[0].removed_at) return { status: "existing" as const };
  if (rows[0]) {
    await transaction.unsafe(
      `UPDATE public.lead_group_members SET role=$3::text, removed_at=NULL, removed_by=NULL,
        created_at=now(), created_by=$4
      WHERE group_id=$1::uuid AND lead_id=$2::uuid`,
      [input.groupId, input.leadId, input.role, input.actorUsername]
    );
  } else {
    await transaction.unsafe(
      `INSERT INTO public.lead_group_members (group_id, lead_id, role, created_by)
      VALUES ($1::uuid, $2::uuid, $3::text, $4)`,
      [input.groupId, input.leadId, input.role, input.actorUsername]
    );
  }
  await recordEvent(transaction, {
    groupId: input.groupId, eventType: "member_added",
    eventDataJson: JSON.stringify({ leadId: input.leadId, role: input.role }),
    actorUsername: input.actorUsername, operationKey: input.operationKey,
  });
  await transaction.unsafe("UPDATE public.lead_groups SET updated_at=now() WHERE id=$1::uuid", [input.groupId]);
  return { status: "added" as const };
}

export async function removeLeadGroupMemberInTransaction(
  transaction: TransactionSql,
  input: { groupId: string; leadId: string; actorUsername: string; operationKey: string }
) {
  const applied = await existingOperation(transaction, input.operationKey);
  if (applied) return { status: "existing" as const };
  await lockGroup(transaction, input.groupId);
  const rows = await transaction.unsafe<Array<{ is_primary_contact: boolean; removed_at: string | Date | null }>>(
    `SELECT is_primary_contact, removed_at FROM public.lead_group_members
    WHERE group_id=$1::uuid AND lead_id=$2::uuid FOR UPDATE`, [input.groupId, input.leadId]
  );
  if (!rows[0] || rows[0].removed_at) return { status: "existing" as const };
  if (rows[0].is_primary_contact) throw new Error("Cambia el contacto principal antes de removerlo.");
  const counts = await transaction.unsafe<Array<{ count: number }>>(
    `SELECT count(*)::int AS count FROM public.lead_group_members
    WHERE group_id=$1::uuid AND removed_at IS NULL`, [input.groupId]
  );
  if (counts[0].count <= 2) throw new Error("El caso debe conservar al menos dos personas.");
  await transaction.unsafe(
    `UPDATE public.lead_group_members SET removed_at=now(), removed_by=$3
    WHERE group_id=$1::uuid AND lead_id=$2::uuid`,
    [input.groupId, input.leadId, input.actorUsername]
  );
  await recordEvent(transaction, {
    groupId: input.groupId, eventType: "member_removed",
    eventDataJson: JSON.stringify({ leadId: input.leadId }),
    actorUsername: input.actorUsername, operationKey: input.operationKey,
  });
  await transaction.unsafe("UPDATE public.lead_groups SET updated_at=now() WHERE id=$1::uuid", [input.groupId]);
  return { status: "removed" as const };
}

export async function addLeadGroupNoteInTransaction(
  transaction: TransactionSql,
  input: { groupId: string; body: string; actorUsername: string; operationKey: string }
) {
  const applied = await existingOperation(transaction, input.operationKey);
  if (applied) return { status: "existing" as const };
  await lockGroup(transaction, input.groupId);
  const notes = await transaction.unsafe<Array<{ id: string }>>(
    `INSERT INTO public.lead_group_notes (
      group_id, body, author_username, idempotency_key
    ) VALUES ($1::uuid, $2, $3, $4::uuid) RETURNING id::text`,
    [input.groupId, input.body, input.actorUsername, input.operationKey]
  );
  await recordEvent(transaction, {
    groupId: input.groupId, eventType: "note_added",
    eventDataJson: JSON.stringify({ noteId: notes[0].id }),
    actorUsername: input.actorUsername, operationKey: input.operationKey,
  });
  await transaction.unsafe("UPDATE public.lead_groups SET updated_at=now() WHERE id=$1::uuid", [input.groupId]);
  return { status: "created" as const };
}

export async function updateLeadGroupInTransaction(
  transaction: TransactionSql,
  input: {
    groupId: string;
    status?: LeadGroupStatus;
    nextFollowUpAt?: string | null;
    markContacted?: boolean;
    actorUsername: string;
    operationKey: string;
  }
) {
  const applied = await existingOperation(transaction, input.operationKey);
  if (applied) return { status: "existing" as const };
  const group = await lockGroup(transaction, input.groupId, input.status !== undefined);
  let eventType = "contacted";
  let eventData: Record<string, unknown> = {};
  if (input.status !== undefined) {
    eventType = "status_changed";
    eventData = { previousStatus: group.status, newStatus: input.status };
    await transaction.unsafe(
      `UPDATE public.lead_groups SET status=$2::text,
        archived_at=CASE WHEN $2::text='archived' THEN now() ELSE NULL END,
        updated_at=now() WHERE id=$1::uuid`, [input.groupId, input.status]
    );
  } else if (input.nextFollowUpAt !== undefined) {
    eventType = "follow_up_changed";
    eventData = { newAt: input.nextFollowUpAt };
    await transaction.unsafe(
      "UPDATE public.lead_groups SET next_follow_up_at=$2::timestamptz, updated_at=now() WHERE id=$1::uuid",
      [input.groupId, input.nextFollowUpAt]
    );
  } else if (input.markContacted) {
    await transaction.unsafe("UPDATE public.lead_groups SET updated_at=now() WHERE id=$1::uuid", [input.groupId]);
  } else {
    throw new Error("Actualización inválida.");
  }
  await recordEvent(transaction, {
    groupId: input.groupId, eventType, eventDataJson: JSON.stringify(eventData),
    actorUsername: input.actorUsername, operationKey: input.operationKey,
  });
  return { status: "updated" as const };
}

export async function updateLeadGroupMemberRoleInTransaction(
  transaction: TransactionSql,
  input: { groupId: string; leadId: string; role: LeadGroupRole; actorUsername: string; operationKey: string }
) {
  if (await existingOperation(transaction, input.operationKey)) return { status: "existing" as const };
  await lockGroup(transaction, input.groupId);
  const rows = await transaction.unsafe<Array<{ role: LeadGroupRole }>>(
    `SELECT role FROM public.lead_group_members
     WHERE group_id=$1::uuid AND lead_id=$2::uuid AND removed_at IS NULL FOR UPDATE`,
    [input.groupId, input.leadId]
  );
  if (!rows[0]) throw new Error("Persona no disponible en el caso.");
  if (rows[0].role !== input.role) {
    await transaction.unsafe(
      `UPDATE public.lead_group_members SET role=$3::text WHERE group_id=$1::uuid AND lead_id=$2::uuid`,
      [input.groupId, input.leadId, input.role]
    );
  }
  await recordEvent(transaction, {
    groupId: input.groupId, eventType: "member_role_changed",
    eventDataJson: JSON.stringify({ leadId: input.leadId, previousRole: rows[0].role, newRole: input.role }),
    actorUsername: input.actorUsername, operationKey: input.operationKey,
  });
  await transaction.unsafe("UPDATE public.lead_groups SET updated_at=now() WHERE id=$1::uuid", [input.groupId]);
  return { status: "updated" as const };
}

export async function changeLeadGroupPrimaryContactInTransaction(
  transaction: TransactionSql,
  input: { groupId: string; leadId: string; actorUsername: string; operationKey: string }
) {
  if (await existingOperation(transaction, input.operationKey)) return { status: "existing" as const };
  await lockGroup(transaction, input.groupId);
  const members = await transaction.unsafe<Array<{ lead_id: string; is_primary_contact: boolean }>>(
    `SELECT lead_id::text, is_primary_contact FROM public.lead_group_members
     WHERE group_id=$1::uuid AND removed_at IS NULL ORDER BY lead_id FOR UPDATE`, [input.groupId]
  );
  const target = members.find((member) => member.lead_id === input.leadId);
  if (!target) throw new Error("El contacto principal debe pertenecer al caso.");
  const previous = members.find((member) => member.is_primary_contact)?.lead_id ?? null;
  if (!target.is_primary_contact) {
    await transaction.unsafe("UPDATE public.lead_group_members SET is_primary_contact=false WHERE group_id=$1::uuid AND removed_at IS NULL", [input.groupId]);
    await transaction.unsafe("UPDATE public.lead_group_members SET is_primary_contact=true WHERE group_id=$1::uuid AND lead_id=$2::uuid AND removed_at IS NULL", [input.groupId, input.leadId]);
  }
  await recordEvent(transaction, {
    groupId: input.groupId, eventType: "primary_contact_changed",
    eventDataJson: JSON.stringify({ previousLeadId: previous, newLeadId: input.leadId }),
    actorUsername: input.actorUsername, operationKey: input.operationKey,
  });
  await transaction.unsafe("UPDATE public.lead_groups SET updated_at=now() WHERE id=$1::uuid", [input.groupId]);
  return { status: "updated" as const };
}
