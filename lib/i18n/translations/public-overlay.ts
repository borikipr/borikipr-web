import { ENGLISH_LOCALE, type AppLocale } from "@/lib/i18n/locales";

type PublicTranslationCandidate = {
  ownerId: string;
  fieldKey: string;
  translatedValue: string | null;
  publishable: boolean;
};

export type PublicPropertySource = {
  id: string;
  titulo: string;
  descripcion?: string | null;
};

export type PublicTestimonialSource = {
  id: string;
  texto: string;
};

export type PublicTranslationReader = {
  fetchPropertyTranslations(
    propertyIds: readonly string[],
    targetLocale: "en-US",
    fieldKeys: readonly ("title" | "description")[]
  ): Promise<PublicTranslationCandidate[]>;
  fetchTestimonialTranslations(
    testimonialIds: readonly string[],
    targetLocale: "en-US",
    fieldKeys: readonly ["body"]
  ): Promise<PublicTranslationCandidate[]>;
};

function uniqueIds(entities: readonly { id: string }[]) {
  return [...new Set(entities.map((entity) => entity.id))];
}

function byOwnerAndField(translations: readonly PublicTranslationCandidate[]) {
  return new Map(
    translations.map((translation) => [
      `${translation.ownerId}:${translation.fieldKey}`,
      translation,
    ])
  );
}

function translatedValueOrFallback(
  candidate: PublicTranslationCandidate | undefined,
  fallback: string
) {
  return candidate?.publishable && candidate.translatedValue?.trim()
    ? candidate.translatedValue
    : fallback;
}

export function applyPropertyTranslationOverlay<T extends PublicPropertySource>(
  properties: readonly T[],
  translations: readonly PublicTranslationCandidate[]
): T[] {
  const candidates = byOwnerAndField(translations);

  return properties.map((property) => {
    const translated = {
      ...property,
      titulo: translatedValueOrFallback(
        candidates.get(`${property.id}:title`),
        property.titulo
      ),
    };

    if (!("descripcion" in property)) return translated;

    return {
      ...translated,
      descripcion: translatedValueOrFallback(
        candidates.get(`${property.id}:description`),
        property.descripcion ?? ""
      ),
    };
  });
}

export function applyTestimonialTranslationOverlay<
  T extends PublicTestimonialSource,
>(
  testimonials: readonly T[],
  translations: readonly PublicTranslationCandidate[]
): T[] {
  const candidates = byOwnerAndField(translations);

  return testimonials.map((testimonial) => ({
    ...testimonial,
    texto: translatedValueOrFallback(
      candidates.get(`${testimonial.id}:body`),
      testimonial.texto
    ),
  }));
}

async function defaultReader(): Promise<PublicTranslationReader> {
  const { sql } = await import("@/lib/db");
  const toCandidate = (row: {
    owner_id: string;
    field_key: string;
    translated_value: string | null;
    publishable: boolean;
  }): PublicTranslationCandidate => ({
    ownerId: row.owner_id,
    fieldKey: row.field_key,
    translatedValue: row.translated_value,
    publishable: row.publishable,
  });
  const selectColumns = `
    field_key,
    translated_value,
    (
      status = 'ready'
      AND translated_value IS NOT NULL
      AND btrim(translated_value) <> ''
      AND source_hash = translated_source_hash
    ) AS publishable
  `;

  return {
    async fetchPropertyTranslations(propertyIds, targetLocale, fieldKeys) {
      if (propertyIds.length === 0 || fieldKeys.length === 0) return [];
      const rows = await sql<{
        owner_id: string;
        field_key: string;
        translated_value: string | null;
        publishable: boolean;
      }[]>`
        SELECT property_id::text AS owner_id, ${sql.unsafe(selectColumns)}
        FROM public.content_translations
        WHERE property_id IN ${sql([...propertyIds])}
          AND target_locale = ${targetLocale}
          AND field_key IN ${sql([...fieldKeys])}
        ORDER BY property_id, field_key
      `;
      return rows.map(toCandidate);
    },
    async fetchTestimonialTranslations(testimonialIds, targetLocale, fieldKeys) {
      if (testimonialIds.length === 0) return [];
      const rows = await sql<{
        owner_id: string;
        field_key: string;
        translated_value: string | null;
        publishable: boolean;
      }[]>`
        SELECT testimonial_id::text AS owner_id, ${sql.unsafe(selectColumns)}
        FROM public.content_translations
        WHERE testimonial_id IN ${sql([...testimonialIds])}
          AND target_locale = ${targetLocale}
          AND field_key IN ${sql([...fieldKeys])}
        ORDER BY testimonial_id, field_key
      `;
      return rows.map(toCandidate);
    },
  };
}

export async function overlayPropertyTranslations<
  T extends PublicPropertySource,
>(input: {
  properties: readonly T[];
  locale: AppLocale;
  reader?: PublicTranslationReader;
}): Promise<T[]> {
  if (input.locale !== ENGLISH_LOCALE || input.properties.length === 0) {
    return [...input.properties];
  }

  const reader = input.reader ?? (await defaultReader());
  const fieldKeys = input.properties.some((property) => "descripcion" in property)
    ? ["title", "description"] as const
    : ["title"] as const;
  const translations = await reader.fetchPropertyTranslations(
    uniqueIds(input.properties),
    "en-US",
    fieldKeys
  );
  return applyPropertyTranslationOverlay(input.properties, translations);
}

export async function overlayPropertyTranslation<
  T extends PublicPropertySource,
>(input: {
  property: T;
  locale: AppLocale;
  reader?: PublicTranslationReader;
}): Promise<T> {
  const [property] = await overlayPropertyTranslations({
    properties: [input.property],
    locale: input.locale,
    reader: input.reader,
  });
  return property;
}

export async function getPropertyTranslationSeoState<T extends PublicPropertySource>(input: {
  property: T;
  locale: AppLocale;
  reader?: PublicTranslationReader;
}) {
  if (input.locale !== ENGLISH_LOCALE) {
    return { property: input.property, titlePublishable: false, descriptionPublishable: false };
  }
  const reader = input.reader ?? (await defaultReader());
  const translations = await reader.fetchPropertyTranslations(
    [input.property.id], "en-US", ["title", "description"]
  );
  const candidates = byOwnerAndField(translations);
  const title = candidates.get(`${input.property.id}:title`);
  const description = candidates.get(`${input.property.id}:description`);
  return {
    property: applyPropertyTranslationOverlay([input.property], translations)[0],
    titlePublishable: title?.publishable === true,
    descriptionPublishable: description?.publishable === true,
  };
}

export async function overlayTestimonialTranslations<
  T extends PublicTestimonialSource,
>(input: {
  testimonials: readonly T[];
  locale: AppLocale;
  reader?: PublicTranslationReader;
}): Promise<T[]> {
  if (input.locale !== ENGLISH_LOCALE || input.testimonials.length === 0) {
    return [...input.testimonials];
  }

  const reader = input.reader ?? (await defaultReader());
  const translations = await reader.fetchTestimonialTranslations(
    uniqueIds(input.testimonials),
    "en-US",
    ["body"]
  );
  return applyTestimonialTranslationOverlay(input.testimonials, translations);
}
