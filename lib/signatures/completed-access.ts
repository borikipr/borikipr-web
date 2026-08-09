import type { SignatureQueryExecutor } from "./domain/types";

export type CompletedArtifactKind = "document" | "certificate";

export async function getCompletedArtifactDescriptor(input: {
  database: SignatureQueryExecutor;
  documentVersionId: string;
  participantId: string;
  kind: CompletedArtifactKind;
}) {
  const rows = await input.database.unsafe<{
    document_id: string; title: string; source_sha256: string;
    final_r2_key: string; final_byte_count: number; final_pdf_sha256: string;
    final_filename: string; certificate_r2_key: string; certificate_byte_count: number;
    certificate_sha256: string;
  }>(
    `SELECT d.id::text AS document_id, d.title, v.source_sha256,
            v.final_r2_key, v.final_byte_count::integer, v.final_pdf_sha256,
            v.final_filename, v.certificate_r2_key, v.certificate_byte_count::integer,
            v.certificate_sha256
       FROM public.signature_participants p
       JOIN public.signature_document_versions v ON v.id=p.document_version_id
       JOIN public.signature_documents d ON d.id=v.document_id
      WHERE p.id=$1::uuid AND p.document_version_id=$2::uuid
        AND p.status='completed' AND d.status='completed' AND d.active_version_id=v.id
        AND v.finalized_at IS NOT NULL`,
    [input.participantId, input.documentVersionId]
  );
  const row = rows[0];
  if (!row) return null;
  return input.kind === "document"
    ? { documentId: row.document_id, sourceSha256: row.source_sha256,
        key: row.final_r2_key, byteCount: row.final_byte_count, sha256: row.final_pdf_sha256,
        filename: row.final_filename }
    : { documentId: row.document_id, sourceSha256: row.source_sha256,
        key: row.certificate_r2_key, byteCount: row.certificate_byte_count,
        sha256: row.certificate_sha256, filename: `${row.title.slice(0, 180)} - certificado.pdf` };
}

export function safeCompletedFilename(value: string) {
  const leaf = value.split(/[\\/]/).pop()?.normalize("NFC").replace(/[\u0000-\u001f\u007f]/g, "").trim();
  if (!leaf || leaf.length > 255 || !leaf.toLowerCase().endsWith(".pdf")) {
    return "documento-firmado.pdf";
  }
  return leaf;
}
