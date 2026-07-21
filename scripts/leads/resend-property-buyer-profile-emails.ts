import * as nextEnv from "@next/env";
import { createHash } from "node:crypto";
import { buildPropertyBuyerProfileInternalEmail } from "../../lib/leads/property-buyer-profile-email";
import { downloadPrivateR2Object, inspectPrivateR2Object } from "../../lib/r2";

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
  created_at: Date;
  idempotency_key: string;
};

type DuplicateClassification =
  | "legitimate_separate_submission"
  | "intentional_resubmission"
  | "accidental_duplicate";

async function main() {
  const applyRequested = process.argv.includes("--apply");
  const includeArgument = process.argv.find((value) => value.startsWith("--include="));
  const reviewedIds = new Set(
    includeArgument?.slice("--include=".length).split(",").map((value) => value.trim()).filter(Boolean) || []
  );
  if (
    applyRequested &&
    process.env[APPLY_SAFEGUARD] !== APPLY_VALUE
  ) {
    throw new Error(
      `Apply mode requires ${APPLY_SAFEGUARD}=${APPLY_VALUE} after dry-run review.`
    );
  }
  if (applyRequested && reviewedIds.size === 0) {
    throw new Error("Apply mode requires an explicit --include=<reviewed submission IDs> list.");
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
        ,profile.created_at
        ,profile.idempotency_key::text
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
    const audited: Array<{
      row: RecoveryRow;
      object: Awaited<ReturnType<typeof inspectPrivateR2Object>>;
      bytes: Buffer | null;
      checksum: string | null;
      wouldResend: boolean;
      classification: DuplicateClassification;
      recommendation: "include" | "exclude";
    }> = [];

    for (const row of rows) {
      const object = await inspectPrivateR2Object(row.document_object_key);
      let bytes: Buffer | null = null;
      let checksum: string | null = null;
      if (object.exists) {
        const downloaded = await downloadPrivateR2Object(row.document_object_key);
        bytes = Buffer.from(downloaded.bytes);
        checksum = createHash("sha256").update(bytes).digest("hex");
      }
      const wouldResend =
        object.exists &&
        bytes?.byteLength === Number(row.document_size_bytes) &&
        !row.correction_queue_status;
      audited.push({
        row,
        object,
        bytes,
        checksum,
        wouldResend,
        classification: "legitimate_separate_submission",
        recommendation: "include",
      });
    }

    const duplicateGroups = classifyDuplicates(audited);

    if (!applyRequested) {
      console.log(
        JSON.stringify(
          {
            mode: "dry-run",
            summary: {
              affectedSubmissions: audited.length,
              objectsPresent: audited.filter((item) => item.object.exists).length,
              objectsMissing: audited.filter((item) => !item.object.exists).length,
              objectMetadataMatches: audited.filter(
                (item) =>
                  item.object.exists &&
                  item.object.contentLength === Number(item.row.document_size_bytes) &&
                  (!item.object.contentType ||
                    item.object.contentType === item.row.document_content_type)
              ).length,
              alreadyCorrectedOrQueued: audited.filter(
                (item) => Boolean(item.row.correction_queue_status)
              ).length,
              wouldResend: audited.filter((item) => item.wouldResend).length,
              recommendedInclude: audited.filter(
                (item) => item.wouldResend && item.recommendation === "include"
              ).length,
              recommendedExclude: audited.filter(
                (item) => item.wouldResend && item.recommendation === "exclude"
              ).length,
            },
            duplicateGroups,
            submissions: audited.map(({ row, object, checksum, bytes, wouldResend, classification, recommendation }) => ({
              submissionId: row.id,
              canonicalLeadId: row.lead_id,
              propertyId: row.property_id,
              createdAt: row.created_at,
              emailFingerprint: fingerprint(row.email_snapshot || ""),
              filenameFingerprint: fingerprint(row.document_original_name),
              objectKeyFingerprint: fingerprint(row.document_object_key),
              sha256: checksum,
              mimeType: row.document_content_type,
              fileSize: Number(row.document_size_bytes),
              objectExists: object.exists,
              objectSizeMatches:
                object.exists &&
                object.contentLength === Number(row.document_size_bytes) &&
                bytes?.byteLength === Number(row.document_size_bytes),
              objectContentTypeMatches:
                object.exists &&
                (!object.contentType || object.contentType === row.document_content_type),
              originalEmailAlreadySent: true,
              originalEmailSentAt: row.original_sent_at,
              correctionStatus: row.correction_queue_status,
              correctionQueuedAt: row.correction_created_at,
              correctionSentAt: row.correction_sent_at,
              wouldResend,
              classification,
              recommendation,
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
    for (const { row, wouldResend, recommendation } of audited) {
      if (!wouldResend || recommendation === "exclude" || !reviewedIds.has(row.id)) {
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

function classifyDuplicates(
  audited: Array<{
    row: RecoveryRow;
    bytes: Buffer | null;
    checksum: string | null;
    classification: DuplicateClassification;
    recommendation: "include" | "exclude";
  }>
) {
  const groups = new Map<string, typeof audited>();
  for (const item of audited) {
    if (!item.bytes || !item.checksum) continue;
    const key = [
      item.row.lead_id,
      normalize(item.row.email_snapshot || ""),
      normalize(item.row.document_original_name),
      item.checksum,
      item.bytes.byteLength,
    ].join("|");
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  }

  const report = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const identicalFileBytes = group.every((item) =>
      item.bytes!.equals(group[0].bytes!)
    );
    if (!identicalFileBytes) continue;

    const byProperty = new Map<string, typeof group>();
    for (const item of group) {
      const entries = byProperty.get(item.row.property_id) || [];
      entries.push(item);
      byProperty.set(item.row.property_id, entries);
    }

    for (const entries of byProperty.values()) {
      if (entries.length === 1) {
        entries[0].classification = "legitimate_separate_submission";
        continue;
      }
      entries.sort(
        (a, b) =>
          new Date(a.row.created_at).getTime() - new Date(b.row.created_at).getTime()
      );
      const baseline = entries[0];
      baseline.classification = "intentional_resubmission";
      for (const item of entries.slice(1)) {
        const exactAnswers = answerFingerprint(item.row) === answerFingerprint(baseline.row);
        const elapsed =
          new Date(item.row.created_at).getTime() -
          new Date(baseline.row.created_at).getTime();
        if (exactAnswers && elapsed >= 0 && elapsed <= 10 * 60 * 1000) {
          item.classification = "accidental_duplicate";
          item.recommendation = "exclude";
        } else {
          item.classification = "intentional_resubmission";
        }
      }
    }

    report.push({
      submissionIds: group.map((item) => item.row.id),
      propertyCount: byProperty.size,
      identicalFileBytes,
      classifications: group.map((item) => ({
        submissionId: item.row.id,
        classification: item.classification,
        recommendation: item.recommendation,
      })),
    });
  }
  return report;
}

function answerFingerprint(row: RecoveryRow) {
  return fingerprint(JSON.stringify({
    purchaseMethod: row.purchase_method,
    purchaseMethodOther: row.purchase_method_other,
    financialInstitution: row.financial_institution,
    closingFunds: row.closing_funds,
    solarContractAcceptance: row.solar_contract_acceptance,
    comments: row.comments,
  }));
}

function normalize(value: string) {
  return value.trim().toLowerCase().normalize("NFKC");
}

function fingerprint(value: string) {
  return createHash("sha256").update(normalize(value)).digest("hex");
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
