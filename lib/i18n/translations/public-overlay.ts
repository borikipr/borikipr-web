import { sql } from "@/lib/db";
import { ENGLISH_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { getTranslatedValueOrSpanishFallback } from "@/lib/i18n/translations/publishable";
import {
  createPostgresTranslationDatabase,
  createTranslationRepository,
  type ContentTranslation,
} from "@/lib/i18n/translations/repository";

type PublicTranslationCandidate = Pick<
  ContentTranslation,
  | "ownerId"
  | "fieldKey"
  | "status"
  | "translatedValue"
  | "sourceHash"
  | "translatedSourceHash"
>;

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

export function applyPropertyTranslationOverlay<T extends PublicPropertySource>(
  properties: readonly T[],
  translations: readonly PublicTranslationCandidate[]
): T[] {
  const candidates = byOwnerAndField(translations);

  return properties.map((property) => {
    const translated = {
      ...property,
      titulo: getTranslatedValueOrSpanishFallback(
        candidates.get(`${property.id}:title`),
        property.titulo
      ),
    };

    if (!("descripcion" in property)) return translated;

    return {
      ...translated,
      descripcion: getTranslatedValueOrSpanishFallback(
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
    texto: getTranslatedValueOrSpanishFallback(
      candidates.get(`${testimonial.id}:body`),
      testimonial.texto
    ),
  }));
}

function defaultReader(): PublicTranslationReader {
  return createTranslationRepository(createPostgresTranslationDatabase(sql));
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

  const translations = await (input.reader ?? defaultReader()).fetchPropertyTranslations(
    uniqueIds(input.properties),
    "en-US",
    ["title", "description"]
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

  const translations = await (input.reader ?? defaultReader()).fetchTestimonialTranslations(
    uniqueIds(input.testimonials),
    "en-US",
    ["body"]
  );
  return applyTestimonialTranslationOverlay(input.testimonials, translations);
}
