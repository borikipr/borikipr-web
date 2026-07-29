import {
  hashPropertyTranslationSource,
  hashTestimonialTranslationSource,
} from "@/lib/i18n/translations/hash";
import type {
  TranslationDatabase,
  TranslationQueryExecutor,
} from "@/lib/i18n/translations/repository";
import {
  syncPropertyTranslationIntents,
  syncTestimonialTranslationIntent,
} from "@/lib/i18n/translations/source-intents";

export type TranslationBackfillReport = {
  propertiesInspected: number;
  testimonialsInspected: number;
  translatableFields: number;
  missingTranslations: number;
  currentTranslations: number;
  staleTranslations: number;
  protectedTranslations: number;
  jobsWouldQueue: number;
  skipped: number;
  emptySources: number;
  writesApplied: number;
};

type PropertySource = {
  id: string;
  titulo: string;
  descripcion: string | null;
  destacado: boolean;
};
type TestimonialSource = {
  id: string;
  texto: string;
  activo: boolean;
};
type ExistingTranslation = {
  owner_id: string;
  field_key: string;
  source_hash: string;
  protected_from_automation: boolean;
};

const BATCH_SIZE = 100;

function emptyReport(): TranslationBackfillReport {
  return {
    propertiesInspected: 0,
    testimonialsInspected: 0,
    translatableFields: 0,
    missingTranslations: 0,
    currentTranslations: 0,
    staleTranslations: 0,
    protectedTranslations: 0,
    jobsWouldQueue: 0,
    skipped: 0,
    emptySources: 0,
    writesApplied: 0,
  };
}

async function inspectOwnerBatch(
  database: TranslationQueryExecutor,
  owner: "property" | "testimonial",
  ids: string[]
) {
  if (ids.length === 0) return new Map<string, ExistingTranslation>();
  const ownerColumn = owner === "property" ? "property_id" : "testimonial_id";
  const rows = await database.unsafe<ExistingTranslation>(
    `SELECT ct.${ownerColumn}::text AS owner_id,
            ct.field_key,
            ct.source_hash,
            ct.protected_from_automation
       FROM public.content_translations ct
      WHERE ct.${ownerColumn} = ANY($1::uuid[])
        AND ct.target_locale = 'en-US'`,
    [ids]
  );
  return new Map(rows.map((row) => [`${row.owner_id}:${row.field_key}`, row]));
}

function inspectField(
  report: TranslationBackfillReport,
  existing: ExistingTranslation | undefined,
  sourceHash: string | null
) {
  report.translatableFields += 1;
  if (!sourceHash) {
    report.emptySources += 1;
    report.skipped += 1;
    return;
  }
  if (!existing) {
    report.missingTranslations += 1;
    report.jobsWouldQueue += 1;
    return;
  }
  if (existing.protected_from_automation) report.protectedTranslations += 1;
  if (existing.source_hash === sourceHash) {
    report.currentTranslations += 1;
    return;
  }
  report.staleTranslations += 1;
  if (!existing.protected_from_automation) report.jobsWouldQueue += 1;
  else report.skipped += 1;
}

export async function runTranslationBackfill(
  database: TranslationDatabase,
  options: { apply?: boolean; batchSize?: number } = {}
) {
  const report = emptyReport();
  const batchSize = options.batchSize ?? BATCH_SIZE;
  if (!Number.isInteger(batchSize) || batchSize <= 0 || batchSize > 500) {
    throw new Error("Backfill batch size must be between 1 and 500.");
  }

  let propertyCursor: string | null = null;
  while (true) {
    const properties: PropertySource[] = await database.unsafe<PropertySource>(
      `SELECT id::text, titulo, descripcion, destacado
         FROM public.propiedades
        WHERE ($1::uuid IS NULL OR id > $1::uuid)
        ORDER BY id
        LIMIT $2`,
      [propertyCursor, batchSize]
    );
    if (properties.length === 0) break;
    const existing = await inspectOwnerBatch(
      database,
      "property",
      properties.map((property) => property.id)
    );
    for (const property of properties) {
      report.propertiesInspected += 1;
      inspectField(
        report,
        existing.get(`${property.id}:title`),
        property.titulo.length
          ? hashPropertyTranslationSource("title", property.titulo)
          : null
      );
      inspectField(
        report,
        existing.get(`${property.id}:description`),
        property.descripcion?.length
          ? hashPropertyTranslationSource("description", property.descripcion)
          : null
      );
      if (options.apply) {
        await database.begin(async (transaction) => {
          await syncPropertyTranslationIntents(transaction, {
            propertyId: property.id,
            title: property.titulo,
            description: property.descripcion,
            highlighted: property.destacado,
          });
        });
        report.writesApplied += 1;
      }
    }
    propertyCursor = properties.at(-1)?.id ?? null;
  }

  let testimonialCursor: string | null = null;
  while (true) {
    const testimonials: TestimonialSource[] =
      await database.unsafe<TestimonialSource>(
        `SELECT id::text, texto, activo
           FROM public.testimonios
          WHERE ($1::uuid IS NULL OR id > $1::uuid)
          ORDER BY id
          LIMIT $2`,
        [testimonialCursor, batchSize]
      );
    if (testimonials.length === 0) break;
    const existing = await inspectOwnerBatch(
      database,
      "testimonial",
      testimonials.map((testimonial) => testimonial.id)
    );
    for (const testimonial of testimonials) {
      report.testimonialsInspected += 1;
      inspectField(
        report,
        existing.get(`${testimonial.id}:body`),
        testimonial.texto.length
          ? hashTestimonialTranslationSource("body", testimonial.texto)
          : null
      );
      if (options.apply) {
        await database.begin(async (transaction) => {
          await syncTestimonialTranslationIntent(transaction, {
            testimonialId: testimonial.id,
            body: testimonial.texto,
            active: testimonial.activo,
          });
        });
        report.writesApplied += 1;
      }
    }
    testimonialCursor = testimonials.at(-1)?.id ?? null;
  }
  return report;
}

export function assertTranslationBackfillApplyIsSafe(input: {
  databaseUrl: string;
  apply: boolean;
  confirmedLocal: boolean;
}) {
  const url = new URL(input.databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    url.hostname.endsWith(".neon.tech") ||
    process.env.VERCEL_ENV === "production" ||
    process.env.NODE_ENV === "production"
  ) {
    throw new Error("Translation backfill refuses production configuration.");
  }
  if (!input.apply) return;
  if (!localHosts.has(url.hostname) || !input.confirmedLocal) {
    throw new Error(
      "Apply mode is restricted to an explicitly confirmed local database."
    );
  }
}
