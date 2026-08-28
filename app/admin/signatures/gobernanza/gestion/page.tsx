import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { getAdminSession } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { formatPuertoRicoDateTimeShort } from "@/lib/puerto-rico-time";
import { GovernanceForms } from "../GovernanceForms";

export const dynamic = "force-dynamic";

export default async function SignatureGovernanceManagementPage() {
  if (!(await getAdminSession())) redirect("/admin/login");

  const database = createPostgresSignatureDatabase(sql);
  const [classifications, consents, privacy, retention, documents, legalHolds, launchAuthorizations] = await Promise.all([
    database.unsafe<{ id: string; document_type: string; version_number: number; status: string }>(`SELECT id::text, document_type, version_number, status FROM signature_document_type_approvals WHERE status IN ('draft', 'pending') ORDER BY created_at DESC`),
    database.unsafe<{ id: string; version_identifier: string; locale: string; status: string; consent_text: string; consent_text_sha256: string }>(`SELECT id::text, version_identifier, locale, status, consent_text, consent_text_sha256 FROM signature_consent_versions WHERE status IN ('draft', 'pending_review') ORDER BY created_at DESC`),
    database.unsafe<{ id: string; version_identifier: string; status: string; es_pr_text: string; en_us_text: string; es_pr_sha256: string; en_us_sha256: string }>(`SELECT id::text, version_identifier, status, es_pr_text, en_us_text, es_pr_sha256, en_us_sha256 FROM signature_privacy_disclosure_versions WHERE status IN ('draft', 'pending_review') ORDER BY created_at DESC`),
    database.unsafe<{ id: string; version_identifier: string; status: string; policy_sha256: string | null }>(`SELECT id::text, version_identifier, status, policy_sha256 FROM signature_retention_policy_versions WHERE status IN ('draft', 'pending_review', 'approved') ORDER BY created_at DESC`),
    database.unsafe<{ id: string; title: string; status: string; document_type: string; participant_emails: string[] }>(`SELECT d.id::text, d.title, d.status, d.document_type, coalesce(array_agg(p.normalized_email ORDER BY p.normalized_email) FILTER (WHERE p.id IS NOT NULL), ARRAY[]::text[]) participant_emails FROM signature_documents d LEFT JOIN signature_document_versions v ON v.id = d.active_version_id LEFT JOIN signature_participants p ON p.document_version_id = v.id WHERE d.status = 'draft' GROUP BY d.id, d.title, d.status, d.document_type, d.created_at ORDER BY d.created_at DESC LIMIT 100`),
    database.unsafe<{ id: string; reason_reference: string }>(`SELECT id::text, reason_reference FROM signature_legal_holds WHERE status = 'active' ORDER BY created_at DESC`),
    database.unsafe<{ id: string; expires_at: Date }>(`SELECT id::text, expires_at FROM signature_launch_authorizations WHERE environment = 'production' AND authorization_type = 'internal_canary' AND status = 'active' AND expires_at > now() ORDER BY authorized_at DESC`),
  ]);

  const drafts = {
    classifications: classifications.map((row) => ({ id: row.id, label: `${row.document_type} v${row.version_number} · ${row.status}`, status: row.status })),
    consents: consents.map((row) => ({ id: row.id, label: `${row.locale} · ${row.version_identifier} · ${row.status}`, status: row.status, reviewText: row.consent_text, reviewHash: row.consent_text_sha256 })),
    privacy: privacy.map((row) => ({ id: row.id, label: `${row.version_identifier} · ${row.status}`, status: row.status, reviewText: `es-PR\n${row.es_pr_text}\n\nen-US\n${row.en_us_text}`, reviewHash: `es-PR ${row.es_pr_sha256} / en-US ${row.en_us_sha256}` })),
    retention: retention.map((row) => ({ id: row.id, label: `${row.version_identifier} · ${row.status}${row.policy_sha256 ? ` · ${row.policy_sha256.slice(0, 12)}…` : ""}`, status: row.status })),
    documents: documents.map((row) => ({ id: row.id, label: `${row.title} · ${row.status}`, documentType: row.document_type, participantEmails: row.participant_emails })),
    legalHolds: legalHolds.map((row) => ({ id: row.id, label: row.reason_reference })),
    launchAuthorizations: launchAuthorizations.map((row) => ({ id: row.id, label: `Canary · expira ${formatPuertoRicoDateTimeShort(row.expires_at)}` })),
  };

  return <AdminPageShell>
    <AdminPageHeader
      breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/signatures", label: "Firmas" }, { href: "/admin/signatures/gobernanza", label: "Estado y soporte" }, { label: "Administración interna" }]}
      eyebrow="Firmas"
      title="Administración interna"
      description="Cambios extraordinarios de versiones, políticas y registros legales. No forma parte de la operación diaria."
      actions={<Link className="btn-secondary" href="/admin/signatures/gobernanza">Volver a Estado y soporte</Link>}
    />
    <GovernanceForms drafts={drafts} />
  </AdminPageShell>;
}
