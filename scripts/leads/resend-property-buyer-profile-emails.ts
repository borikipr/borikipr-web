import * as nextEnv from "@next/env";
import { buildPropertyBuyerProfileInternalEmail } from "../../lib/leads/property-buyer-profile-email";
import { inspectPrivateR2Object } from "../../lib/r2";

nextEnv.loadEnvConfig(process.cwd());

const APPLY_SAFEGUARD = "PROPERTY_BUYER_PROFILE_RESEND_APPLY";
const APPLY_VALUE = "YES";
const CORRECTION_EMAIL_TYPE = "property_buyer_profile_internal_correction";

type RecoveryRow = {
  id: string;
  lead_id: string;
  name_snapshot: string;
  email_snapshot: string | null;
  phone_snapshot: string;
  purchase_method: "Financiamiento" | "Cash" | "Otro";
  purchase_method_other: string | null;
  financial_institution: string | null;
  closing_funds: string | null;
  solar_contract_acceptance: string | null;
  comments: string | null;
  document_object_key: string;
  document_original_name: string;
  document_content_type: string;
  document_size_bytes: number | string;
  document_status: "uploaded";
  property_id: string;
  property_slug: string;
  property_title: string;
  municipio: string;
  sector_comunidad: string | null;
  property_status: string;
  placas_en_lease: boolean;
  original_queue_status: string;
  original_sent_at: Date;
  correction_queue_status: string | null;
  correction_created_at: Date | null;
  correction_sent_at: Date | null;
};

async function main() {
  const applyRequested = process.argv.includes("--apply");
  if (
    applyRequested &&
    process.env[APPLY_SAFEGUARD] !== APPLY_VALUE
  ) {
    throw new Error(
      `Apply mode requires ${APPLY_SAFEGUARD}=${APPLY_VALUE} after dry-run review.`
    );
  }

  const [{ sql }, { queueCanonicalLeadEmail }] = await Promise.all([
    import("../../lib/db"),
    import("../../lib/email-queue"),
  ]);

  try {
    const rows = await sql<RecoveryRow[]>`
      SELECT
        profile.id::text,
        profile.lead_id::text,
        profile.name_snapshot,
        profile.email_snapshot,
        profile.phone_snapshot,
        profile.purchase_method,
        profile.purchase_method_other,
        profile.financial_institution,
        profile.closing_funds,
        profile.solar_contract_acceptance,
        profile.comments,
        profile.document_object_key,
        profile.document_original_name,
        profile.document_content_type,
        profile.document_size_bytes,
        profile.document_status,
        property.id::text AS property_id,
        property.slug AS property_slug,
        property.titulo AS property_title,
        property.municipio,
        to_jsonb(property)->>'sector_comunidad' AS sector_comunidad,
        property.estado AS property_status,
        COALESCE(property.placas_en_lease, false) AS placas_en_lease,
        original.status AS original_queue_status,
        original.sent_at AS original_sent_at,
        correction.status AS correction_queue_status,
        correction.created_at AS correction_created_at,
        correction.sent_at AS correction_sent_at
      FROM public.property_buyer_profiles profile
      JOIN public.propiedades property ON property.id = profile.property_id
      JOIN public.email_queue original
        ON original.related_submission_type = 'property_buyer_profile'
       AND original.related_submission_id = profile.id
       AND original.dedupe_key =
           'property_buyer_profile:' || profile.id::text || ':internal:v1'
       AND original.status = 'sent'
       AND original.sent_at IS NOT NULL
      LEFT JOIN public.email_queue correction
        ON correction.related_submission_type = 'property_buyer_profile'
       AND correction.related_submission_id = profile.id
       AND correction.dedupe_key =
           'property_buyer_profile:' || profile.id::text || ':internal:corrected:v1'
      WHERE profile.document_status = 'uploaded'
        AND profile.document_object_key IS NOT NULL
        AND profile.document_original_name IS NOT NULL
        AND profile.document_content_type IS NOT NULL
        AND profile.document_size_bytes IS NOT NULL
      ORDER BY profile.created_at ASC, profile.id ASC
    `;

    const recipient =
      process.env.CONTACT_TO_EMAIL?.trim() ||
      "ericksonrealestatepr@gmail.com";
    const audited = [];

    for (const row of rows) {
      const object = await inspectPrivateR2Object(row.document_object_key);
      const wouldResend = object.exists && !row.correction_queue_status;
      audited.push({ row, object, wouldResend });
    }

    if (!applyRequested) {
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            summary: {
              affectedSubmissions: audited.length,
              objectsPresent: audited.filter((item) => item.object.exists).length,
              objectsMissing: audited.filter((item) => !item.object.exists).length,
              alreadyCorrectedOrQueued: audited.filter(
                (item) => Boolean(item.row.correction_queue_status)
              ).length,
              wouldResend: audited.filter((item) => item.wouldResend).length,
            },
            submissions: audited.map(({ row, object, wouldResend }) => ({
              submissionId: row.id,
              buyerName: row.name_snapshot,
              buyerEmail: row.email_snapshot,
              property: row.property_title,
              r2ObjectKey: row.document_object_key,
              originalFilename: row.document_original_name,
              mimeType: row.document_content_type,
              fileSize: Number(row.document_size_bytes),
              objectExists: object.exists,
              objectSizeMatches:
                object.exists &&
                object.contentLength === Number(row.document_size_bytes),
              recipient,
              originalEmailAlreadySent: true,
              originalEmailSentAt: row.original_sent_at,
              correctionStatus: row.correction_queue_status,
              correctionQueuedAt: row.correction_created_at,
              correctionSentAt: row.correction_sent_at,
              wouldResend,
            })),
          },
          null,
          2
        )
      );
      return;
    }

    let queued = 0;
    let alreadyQueued = 0;
    for (const { row, wouldResend } of audited) {
      if (!wouldResend) {
        alreadyQueued += 1;
        continue;
      }

      const email = buildPropertyBuyerProfileInternalEmail({
        profile: {
          nameSnapshot: row.name_snapshot,
          emailSnapshot: row.email_snapshot,
          phoneSnapshot: row.phone_snapshot,
          purchaseMethod: row.purchase_method,
          purchaseMethodOther: row.purchase_method_other,
          financialInstitution: row.financial_institution,
          closingFunds: row.closing_funds,
          solarContractAcceptance: row.solar_contract_acceptance,
          comments: row.comments,
          documentOriginalName: row.document_original_name,
          property: {
            id: row.property_id,
            slug: row.property_slug,
            title: row.property_title,
            municipio: row.municipio,
            sectorComunidad: row.sector_comunidad,
            status: row.property_status,
            hasSolarLease: row.placas_en_lease,
          },
        },
        documentStatus: "uploaded",
        correctedResend: true,
      });
      const state = await queueCanonicalLeadEmail({
        recipient,
        subject: email.subject,
        html: email.html,
        emailType: CORRECTION_EMAIL_TYPE,
        relatedPropertyId: row.property_id,
        canonicalLeadId: row.lead_id,
        relatedSubmissionType: "property_buyer_profile",
        relatedSubmissionId: row.id,
        dedupeKey: `property_buyer_profile:${row.id}:internal:corrected:v1`,
      });
      if (state === "queued") queued += 1;
      else alreadyQueued += 1;
    }

    console.log(
      JSON.stringify({
        mode: "apply",
        reviewed: audited.length,
        queued,
        alreadyQueued,
      })
    );
  } finally {
    await sql.end();
  }
}

async function run() {
  try {
    await main();
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    console.error("PROPERTY BUYER PROFILE CORRECTED RESEND FAILED", { code });
    process.exitCode = 1;
  }
}

void run();
