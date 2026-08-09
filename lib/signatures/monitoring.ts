import type { SignatureQueryExecutor } from "./domain/types";

export async function getSignatureOperationalSnapshot(database: SignatureQueryExecutor) {
  const rows = await database.unsafe<Record<string, number | bigint>>(
    `SELECT
      (SELECT count(*) FROM public.signature_documents WHERE status='draft') AS drafts,
      (SELECT count(*) FROM public.signature_delivery_intents WHERE status='pending') AS invitations_pending,
      (SELECT count(*) FROM public.signature_delivery_intents WHERE status='failed') AS delivery_failures,
      (SELECT count(*) FROM public.signature_sessions WHERE revoked_at IS NULL AND completed_at IS NULL
        AND expires_at > now() AND idle_expires_at > now()) AS active_sessions,
      (SELECT count(*) FROM public.signature_documents WHERE status='partially_signed') AS partial_requests,
      (SELECT count(*) FROM public.signature_documents WHERE status='completed') AS completed_requests,
      (SELECT count(*) FROM public.signature_documents WHERE status='expired') AS expired_requests,
      (SELECT count(*) FROM public.signature_documents d JOIN public.signature_document_versions v ON v.id=d.active_version_id
        WHERE d.status='partially_signed' AND v.finalized_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM public.signature_participants p WHERE p.document_version_id=v.id AND p.status<>'completed')) AS finalization_failures_or_stalls,
      (SELECT count(*) FROM public.signature_documents d JOIN public.signature_document_versions v ON v.id=d.active_version_id
        WHERE d.status='completed' AND (v.final_pdf_sha256 IS NULL OR v.final_byte_count IS NULL
          OR v.final_r2_key IS NULL OR v.certificate_sha256 IS NULL
          OR v.certificate_byte_count IS NULL OR v.certificate_r2_key IS NULL)) AS integrity_failures`
  );
  const row = rows[0] ?? {};
  return Object.freeze(Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)])));
}
