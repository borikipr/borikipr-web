"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TransactionSql } from "postgres";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { setLeadFollowUp } from "@/lib/admin/lead-follow-up-mutations";
import { sql } from "@/lib/db";
import {
  LEAD_RELATIONSHIP_LABELS,
  LEAD_STATUS_LABELS,
  type LeadRelationshipType,
  type LeadStatus,
} from "@/lib/admin/queries/lead-360";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const username = await getAdminSessionUser();
  if (!username) throw new Error("No autorizado.");
  return username;
}

function requiredUuid(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (!UUID_PATTERN.test(value)) throw new Error("Identificador inválido.");
  return value;
}

function leadHref(leadId: string, message: string) {
  return `/admin/leads/${leadId}?ok=${encodeURIComponent(message)}`;
}

async function operationAlreadyApplied(
  transaction: TransactionSql,
  operationKey: string
) {
  const rows = await transaction.unsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
      SELECT 1 FROM public.lead_management_events
      WHERE idempotency_key = $1::uuid
    ) AS exists`,
    [operationKey]
  );
  return rows[0]?.exists ?? false;
}

async function assertActiveLead(
  transaction: TransactionSql,
  leadId: string
) {
  const rows = await transaction.unsafe<{ id: string }[]>(
    `SELECT id::text
    FROM public.leads
    WHERE id = $1::uuid
      AND merged_into_lead_id IS NULL
    FOR UPDATE`,
    [leadId]
  );
  if (!rows[0]) throw new Error("No se encontró el lead.");
}

export async function updateLeadStatusAction(formData: FormData) {
  const username = await requireAdmin();
  const leadId = requiredUuid(formData, "lead_id");
  const operationKey = requiredUuid(formData, "operation_key");
  const status = String(formData.get("status") ?? "") as LeadStatus;
  if (!(status in LEAD_STATUS_LABELS) || status === "merged") {
    throw new Error("Estado inválido.");
  }

  await sql.begin(async (transaction) => {
    if (await operationAlreadyApplied(transaction, operationKey)) return;
    await assertActiveLead(transaction, leadId);
    const current = await transaction.unsafe<{ status: LeadStatus }[]>(
      "SELECT status FROM public.leads WHERE id = $1::uuid",
      [leadId]
    );
    const previousStatus = current[0].status;
    if (previousStatus === status) return;

    await transaction.unsafe(
      `UPDATE public.leads
      SET status = $2, updated_at = now()
      WHERE id = $1::uuid`,
      [leadId, status]
    );
    await transaction.unsafe(
      `INSERT INTO public.lead_management_events (
        lead_id, event_type, event_data, actor_username, idempotency_key
      ) VALUES (
        $1::uuid,
        'status_changed',
        jsonb_build_object('previousStatus', $2, 'newStatus', $3),
        $4,
        $5::uuid
      )`,
      [leadId, previousStatus, status, username, operationKey]
    );
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads");
  redirect(leadHref(leadId, "Estado actualizado"));
}

export async function updateLeadFollowUpAction(formData: FormData) {
  const username = await requireAdmin();
  const leadId = requiredUuid(formData, "lead_id");
  const operationKey = requiredUuid(formData, "operation_key");
  const raw = String(formData.get("next_follow_up_at") ?? "").trim();
  if (raw && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    throw new Error("Fecha inválida.");
  }
  const parsed = raw ? new Date(`${raw}:00-04:00`) : null;
  if (parsed && Number.isNaN(parsed.getTime())) throw new Error("Fecha inválida.");

  await sql.begin(async (transaction) => {
    await setLeadFollowUp(transaction, {
      leadId,
      nextAt: parsed?.toISOString() ?? null,
      operationKey,
      username,
    });
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath("/admin/leads/seguimientos");
  redirect(leadHref(leadId, "Seguimiento actualizado"));
}

export async function addLeadNoteAction(formData: FormData) {
  const username = await requireAdmin();
  const leadId = requiredUuid(formData, "lead_id");
  const operationKey = requiredUuid(formData, "operation_key");
  const body = String(formData.get("body") ?? "").trim();
  if (!body || body.length > 5000) throw new Error("La nota debe tener entre 1 y 5,000 caracteres.");

  await sql.begin(async (transaction) => {
    if (await operationAlreadyApplied(transaction, operationKey)) return;
    await assertActiveLead(transaction, leadId);
    const notes = await transaction.unsafe<{ id: string }[]>(
      `INSERT INTO public.lead_notes (
        lead_id, body, author_username, idempotency_key
      ) VALUES (
        $1::uuid, $2, $3, $4::uuid
      )
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id::text`,
      [leadId, body, username, operationKey]
    );
    if (!notes[0]) return;
    await transaction.unsafe(
      `INSERT INTO public.lead_management_events (
        lead_id, event_type, event_data, actor_username, idempotency_key
      ) VALUES (
        $1::uuid,
        'note_added',
        jsonb_build_object('noteId', $2),
        $3,
        $4::uuid
      )`,
      [leadId, notes[0].id, username, operationKey]
    );
  });

  revalidatePath(`/admin/leads/${leadId}`);
  redirect(leadHref(leadId, "Nota guardada"));
}

export async function createLeadRelationshipAction(formData: FormData) {
  const username = await requireAdmin();
  const leadId = requiredUuid(formData, "lead_id");
  const relatedLeadId = requiredUuid(formData, "related_lead_id");
  const operationKey = requiredUuid(formData, "operation_key");
  const relationshipType = String(formData.get("relationship_type") ?? "") as LeadRelationshipType;
  if (!(relationshipType in LEAD_RELATIONSHIP_LABELS) || leadId === relatedLeadId) {
    throw new Error("Relación inválida.");
  }

  await sql.begin(async (transaction) => {
    if (await operationAlreadyApplied(transaction, operationKey)) return;
    await assertActiveLead(transaction, leadId);
    await assertActiveLead(transaction, relatedLeadId);
    const rows = await transaction.unsafe<{ id: string }[]>(
      `INSERT INTO public.lead_relationships (
        lead_id, related_lead_id, relationship_type, created_by
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4
      )
      ON CONFLICT (
        LEAST(lead_id, related_lead_id),
        GREATEST(lead_id, related_lead_id)
      ) DO UPDATE SET
        relationship_type = EXCLUDED.relationship_type,
        created_by = EXCLUDED.created_by,
        updated_at = now()
      RETURNING id::text`,
      [leadId, relatedLeadId, relationshipType, username]
    );
    await transaction.unsafe(
      `INSERT INTO public.lead_management_events (
        lead_id, event_type, event_data, actor_username, idempotency_key
      ) VALUES (
        $1::uuid,
        'relationship_created',
        jsonb_build_object(
          'relationshipId', $2,
          'relatedLeadId', $3,
          'relationshipType', $4
        ),
        $5,
        $6::uuid
      )`,
      [leadId, rows[0].id, relatedLeadId, relationshipType, username, operationKey]
    );
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath(`/admin/leads/${relatedLeadId}`);
  redirect(leadHref(leadId, "Relación guardada"));
}

export async function keepLeadsSeparateAction(formData: FormData) {
  const username = await requireAdmin();
  const leadId = requiredUuid(formData, "lead_id");
  const comparedLeadId = requiredUuid(formData, "compared_lead_id");
  const operationKey = requiredUuid(formData, "operation_key");
  if (leadId === comparedLeadId) throw new Error("Comparación inválida.");

  await sql.begin(async (transaction) => {
    if (await operationAlreadyApplied(transaction, operationKey)) return;
    await assertActiveLead(transaction, leadId);
    await assertActiveLead(transaction, comparedLeadId);
    const reviews = await transaction.unsafe<{ id: string }[]>(
      `INSERT INTO public.lead_duplicate_reviews (
        lead_id, compared_lead_id, decision, decided_by
      ) VALUES (
        $1::uuid, $2::uuid, 'keep_separate', $3
      )
      ON CONFLICT (
        LEAST(lead_id, compared_lead_id),
        GREATEST(lead_id, compared_lead_id)
      ) DO UPDATE SET
        decision = 'keep_separate',
        decided_by = EXCLUDED.decided_by,
        updated_at = now()
      RETURNING id::text`,
      [leadId, comparedLeadId, username]
    );
    await transaction.unsafe(
      `INSERT INTO public.lead_management_events (
        lead_id, event_type, event_data, actor_username, idempotency_key
      ) VALUES (
        $1::uuid,
        'duplicate_reviewed',
        jsonb_build_object(
          'reviewId', $2,
          'comparedLeadId', $3,
          'decision', 'keep_separate'
        ),
        $4,
        $5::uuid
      )`,
      [leadId, reviews[0].id, comparedLeadId, username, operationKey]
    );
  });

  revalidatePath(`/admin/leads/${leadId}`);
  revalidatePath(`/admin/leads/${comparedLeadId}`);
  redirect(leadHref(leadId, "Las identidades se mantendrán separadas"));
}
