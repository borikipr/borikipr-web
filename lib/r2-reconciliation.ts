import { sql } from "@/lib/db";
import {
  deleteEligiblePublicMediaObject,
  extractManagedPublicObjectKey,
  inspectPrivateR2Object,
  listManagedR2ObjectsPage,
  type ManagedR2Object,
} from "@/lib/r2";
import {
  classifyR2Objects,
  redactR2Identifier,
} from "@/lib/r2-reconciliation-policy";

type FinancialReference = {
  key: string;
  expectedSize: number | null;
  expectedMime: string | null;
};

export type R2ReconciliationReport = {
  mode: "dry-run" | "apply-public-media";
  referencedPublicMedia: number;
  referencedFinancialDocuments: number;
  missingPublicMedia: number;
  missingFinancialDocuments: number;
  orphanPropertyMedia: number;
  orphanTestimonialMedia: number;
  financialOrphansExcluded: number;
  metadataMismatches: number;
  duplicateReferences: number;
  invalidReferences: number;
  eligiblePublicMedia: number;
  deletedPublicMedia: number;
  redactedSamples: string[];
};

export async function reconcileR2(input?: {
  applyPublicMedia?: boolean;
  now?: Date;
}): Promise<R2ReconciliationReport> {
  const now = input?.now ?? new Date();
  const [propertyRows, testimonialRows, profileRows, registrationRows] =
    await Promise.all([
      sql<{ url: string }[]>`
        SELECT url FROM public.propiedad_imagenes WHERE url IS NOT NULL
      `,
      sql<{ foto_url: string }[]>`
        SELECT foto_url FROM public.testimonios WHERE foto_url IS NOT NULL
      `,
      sql<
        {
          key: string;
          expected_size: number | null;
          expected_mime: string | null;
        }[]
      >`
        SELECT document_object_key AS key,
               document_size_bytes AS expected_size,
               document_content_type AS expected_mime
        FROM public.property_buyer_profiles
        WHERE document_object_key IS NOT NULL
      `,
      sql<
        {
          pre_key: string | null;
          pre_size: number | null;
          pre_mime: string | null;
          funds_key: string | null;
          funds_size: number | null;
          funds_mime: string | null;
        }[]
      >`
        SELECT carta_precalificacion_key AS pre_key,
               CASE
                 WHEN (respuestas_personalizadas->'document_metadata'->>'size_bytes') ~ '^[0-9]+$'
                 THEN (respuestas_personalizadas->'document_metadata'->>'size_bytes')::bigint
                 ELSE NULL
               END AS pre_size,
               respuestas_personalizadas->'document_metadata'->>'content_type' AS pre_mime,
               evidencia_fondos_key AS funds_key,
               CASE
                 WHEN (respuestas_personalizadas->'document_metadata'->>'size_bytes') ~ '^[0-9]+$'
                 THEN (respuestas_personalizadas->'document_metadata'->>'size_bytes')::bigint
                 ELSE NULL
               END AS funds_size,
               respuestas_personalizadas->'document_metadata'->>'content_type' AS funds_mime
        FROM public.consultas_propiedad
        WHERE carta_precalificacion_key IS NOT NULL
           OR evidencia_fondos_key IS NOT NULL
      `,
    ]);

  const invalidReferences: string[] = [];
  const publicReferenceValues = [
    ...propertyRows.map((row) => row.url),
    ...testimonialRows.map((row) => row.foto_url),
  ];
  const publicReferences = new Set<string>();
  for (const value of publicReferenceValues) {
    const key = extractManagedPublicObjectKey(value);
    if (key) publicReferences.add(key);
    else invalidReferences.push(value);
  }

  const financialRows: FinancialReference[] = [
    ...profileRows.map((row) => ({
      key: row.key,
      expectedSize: row.expected_size,
      expectedMime: row.expected_mime,
    })),
    ...registrationRows.flatMap((row) => {
      const refs: FinancialReference[] = [];
      if (row.pre_key) {
        refs.push({
          key: row.pre_key,
          expectedSize: row.pre_size,
          expectedMime: row.pre_mime,
        });
      }
      if (row.funds_key) {
        refs.push({
          key: row.funds_key,
          expectedSize: row.funds_size,
          expectedMime: row.funds_mime,
        });
      }
      return refs;
    }),
  ];
  const financialReferences = new Set(financialRows.map((row) => row.key));
  const duplicateReferences =
    publicReferenceValues.length -
    publicReferences.size +
    financialRows.length -
    financialReferences.size;

  const objects: ManagedR2Object[] = [];
  for (const prefix of ["propiedades/", "testimonios/", "lead-documents/"]) {
    let continuationToken: string | undefined;
    do {
      const page = await listManagedR2ObjectsPage({
        prefix,
        continuationToken,
        maxKeys: 500,
      });
      objects.push(...page.objects);
      continuationToken = page.nextContinuationToken;
    } while (continuationToken);
  }

  const objectKeys = new Set(objects.map((object) => object.key));
  const missingPublic = [...publicReferences].filter(
    (key) => !objectKeys.has(key)
  );
  const missingFinancial = [...financialReferences].filter(
    (key) => !objectKeys.has(key)
  );
  let metadataMismatches = 0;
  for (const reference of financialRows) {
    if (!objectKeys.has(reference.key)) continue;
    const object = await inspectPrivateR2Object(reference.key);
    if (
      !object.exists ||
      (reference.expectedSize !== null &&
        object.contentLength !== reference.expectedSize) ||
      (reference.expectedMime !== null &&
        object.contentType !== reference.expectedMime)
    ) {
      metadataMismatches += 1;
    }
  }

  const classified = classifyR2Objects({
    objects,
    publicReferences,
    financialReferences,
    now,
  });
  let deletedPublicMedia = 0;
  if (input?.applyPublicMedia) {
    for (const object of classified.eligiblePublicMedia) {
      await deleteEligiblePublicMediaObject(object.key);
      deletedPublicMedia += 1;
    }
  }

  const samples = [
    ...missingPublic,
    ...missingFinancial,
    ...classified.eligiblePublicMedia.map((object) => object.key),
  ]
    .slice(0, 10)
    .map(redactR2Identifier);

  return {
    mode: input?.applyPublicMedia ? "apply-public-media" : "dry-run",
    referencedPublicMedia: publicReferences.size,
    referencedFinancialDocuments: financialReferences.size,
    missingPublicMedia: missingPublic.length,
    missingFinancialDocuments: missingFinancial.length,
    orphanPropertyMedia: classified.orphanPropertyMedia.length,
    orphanTestimonialMedia: classified.orphanTestimonialMedia.length,
    financialOrphansExcluded: classified.financialOrphansExcluded.length,
    metadataMismatches,
    duplicateReferences,
    invalidReferences: invalidReferences.length,
    eligiblePublicMedia: classified.eligiblePublicMedia.length,
    deletedPublicMedia,
    redactedSamples: samples,
  };
}
