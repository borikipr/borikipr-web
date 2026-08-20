import type { SignatureQueryExecutor } from "../domain/types";

export function createSignerRepository(database: SignatureQueryExecutor) {
  return {
    async view(documentVersionId: string, participantId: string) {
      const documents = await database.unsafe<{
        title: string; role: string; page_count: number; page_geometry_manifest: unknown;
        participant_status: string; consent_version: string | null;
        consent_text: string | null; consent_text_sha256: string | null;
        consent_locale: "es-PR" | "en-US" | null;
        privacy_disclosure_version: string | null;
        privacy_disclosure_es_pr_sha256: string | null;
        privacy_disclosure_en_us_sha256: string | null;
        privacy_disclosure_effective_from: string | Date | null;
        privacy_disclosure_approval_reference: string | null;
        privacy_disclosure_es_pr_text: string | null;
        privacy_disclosure_en_us_text: string | null;
      }>(
        `SELECT d.title, p.role, v.page_count, v.page_geometry_manifest,
                p.status AS participant_status, p.consent_version,
                cv.consent_text, cv.consent_text_sha256, cv.locale AS consent_locale,
                d.privacy_disclosure_version, d.privacy_disclosure_es_pr_sha256,
                d.privacy_disclosure_en_us_sha256, d.privacy_disclosure_effective_from,
                d.privacy_disclosure_approval_reference, d.privacy_disclosure_es_pr_text,
                d.privacy_disclosure_en_us_text
           FROM public.signature_participants p
           JOIN public.signature_document_versions v ON v.id=p.document_version_id
           JOIN public.signature_documents d ON d.id=v.document_id
           LEFT JOIN public.signature_consent_versions cv ON cv.id=d.consent_version_id
          WHERE p.id=$1::uuid AND p.document_version_id=$2::uuid`,
        [participantId, documentVersionId]
      );
      if (!documents[0]) return null;
      const fields = await database.unsafe<{
        id: string; field_type: "signature" | "initials" | "date" | "date_signed" | "text";
        page_index: number; normalized_x: string; normalized_y: string;
        normalized_width: string; normalized_height: string; label: string;
        required: boolean; tab_order: number; validation_limits: unknown; completed: boolean;
      }>(
        `SELECT f.id::text, f.field_type, f.page_index, f.normalized_x::text,
                f.normalized_y::text, f.normalized_width::text, f.normalized_height::text,
                f.label, f.required, f.tab_order, f.validation_limits,
                EXISTS(SELECT 1 FROM public.signature_field_values fv WHERE fv.signature_field_id=f.id) AS completed
           FROM public.signature_fields f
          WHERE f.document_version_id=$1::uuid AND f.participant_id=$2::uuid
          ORDER BY f.tab_order`,
        [documentVersionId, participantId]
      );
      return {
        ...documents[0],
        fields: fields.map((field) => ({
          ...field,
          x: Number(field.normalized_x), y: Number(field.normalized_y),
          width: Number(field.normalized_width), height: Number(field.normalized_height),
        })),
      };
    },
    async sourceDescriptor(documentVersionId: string) {
      const rows = await database.unsafe<{ key: string; byte_count: number; source_sha256: string }>(
        `SELECT source_r2_key AS key, byte_count::integer, source_sha256
           FROM public.signature_document_versions WHERE id=$1::uuid`,
        [documentVersionId]
      );
      return rows[0] ?? null;
    },
  };
}
