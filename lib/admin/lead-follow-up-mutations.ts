import type { TransactionSql } from "postgres";

export const ACTIONABLE_LEAD_STATUSES = ["new", "active"] as const;

async function operationAlreadyApplied(transaction: TransactionSql, operationKey: string) {
  const rows = await transaction.unsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (
      SELECT 1 FROM public.lead_management_events
      WHERE idempotency_key = $1::uuid
    ) AS exists`,
    [operationKey]
  );
  return rows[0]?.exists ?? false;
}

async function lockLead(
  transaction: TransactionSql,
  leadId: string,
  actionableOnly: boolean
) {
  const rows = await transaction.unsafe<{
    status: string;
    next_follow_up_at: string | Date | null;
  }[]>(
    `SELECT status, next_follow_up_at
     FROM public.leads
     WHERE id = $1::uuid
       AND merged_into_lead_id IS NULL
       ${actionableOnly ? "AND status IN ('new', 'active')" : ""}
     FOR UPDATE`,
    [leadId]
  );
  if (!rows[0]) throw new Error("El lead no está disponible para seguimiento.");
  return rows[0];
}

export async function setLeadFollowUp(
  transaction: TransactionSql,
  input: {
    leadId: string;
    nextAt: string | null;
    operationKey: string;
    username: string;
    actionableOnly?: boolean;
  }
) {
  if (await operationAlreadyApplied(transaction, input.operationKey)) return false;
  const current = await lockLead(transaction, input.leadId, input.actionableOnly ?? false);
  const previousAt = current.next_follow_up_at
    ? new Date(current.next_follow_up_at).toISOString()
    : null;
  if (previousAt === input.nextAt) return false;

  await transaction.unsafe(
    `UPDATE public.leads
     SET next_follow_up_at = $2::timestamptz, updated_at = now()
     WHERE id = $1::uuid`,
    [input.leadId, input.nextAt]
  );
  await transaction.unsafe(
    `INSERT INTO public.lead_management_events (
       lead_id, event_type, event_data, actor_username, idempotency_key
     ) VALUES (
       $1::uuid, 'follow_up_changed',
       jsonb_build_object('previousAt', $2::timestamptz, 'newAt', $3::timestamptz),
       $4, $5::uuid
     )`,
    [input.leadId, previousAt, input.nextAt, input.username, input.operationKey]
  );
  return true;
}

export async function markLeadContacted(
  transaction: TransactionSql,
  input: { leadId: string; operationKey: string; username: string }
) {
  if (await operationAlreadyApplied(transaction, input.operationKey)) return false;
  const current = await lockLead(transaction, input.leadId, true);
  const nextStatus = current.status === "new" ? "active" : current.status;

  await transaction.unsafe(
    `UPDATE public.leads
     SET status = $2, last_activity_at = now(), updated_at = now()
     WHERE id = $1::uuid`,
    [input.leadId, nextStatus]
  );
  await transaction.unsafe(
    `INSERT INTO public.lead_management_events (
       lead_id, event_type, event_data, actor_username, idempotency_key
     ) VALUES (
       $1::uuid, 'contacted',
       jsonb_build_object('previousStatus', $2::text, 'newStatus', $3::text),
       $4, $5::uuid
     )`,
    [input.leadId, current.status, nextStatus, input.username, input.operationKey]
  );
  return true;
}
