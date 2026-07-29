import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  type AppLocale,
} from "@/lib/i18n/locales";

export const TRANSLATION_SOURCE_LOCALE = DEFAULT_LOCALE;
export const TRANSLATION_TARGET_LOCALES = [ENGLISH_LOCALE] as const;
export type TranslationTargetLocale =
  (typeof TRANSLATION_TARGET_LOCALES)[number];

export const TRANSLATION_ENTITY_TYPES = ["property", "testimonial"] as const;
export type TranslationEntityType =
  (typeof TRANSLATION_ENTITY_TYPES)[number];

export const PROPERTY_TRANSLATION_FIELDS = [
  "title",
  "description",
] as const;
export type PropertyTranslationField =
  (typeof PROPERTY_TRANSLATION_FIELDS)[number];

export const TESTIMONIAL_TRANSLATION_FIELDS = ["body"] as const;
export type TestimonialTranslationField =
  (typeof TESTIMONIAL_TRANSLATION_FIELDS)[number];

export type TranslationField =
  | PropertyTranslationField
  | TestimonialTranslationField;

export const TRANSLATION_STATUSES = [
  "pending",
  "processing",
  "ready",
  "stale",
  "failed",
] as const;
export type TranslationStatus = (typeof TRANSLATION_STATUSES)[number];

export const TRANSLATION_ORIGINS = ["machine", "manual"] as const;
export type TranslationOrigin = (typeof TRANSLATION_ORIGINS)[number];

export const TRANSLATION_REVIEW_STATUSES = [
  "unreviewed",
  "reviewed",
] as const;
export type TranslationReviewStatus =
  (typeof TRANSLATION_REVIEW_STATUSES)[number];

export const TRANSLATION_JOB_STATUSES = [
  "queued",
  "processing",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export type TranslationJobStatus =
  (typeof TRANSLATION_JOB_STATUSES)[number];

export const TRANSLATION_REVISION_EVENT_TYPES = [
  "created",
  "source_changed",
  "job_queued",
  "generation_succeeded",
  "generation_failed",
  "manually_edited",
  "reviewed",
  "automation_unprotected",
  "regeneration_authorized",
] as const;
export type TranslationRevisionEventType =
  (typeof TRANSLATION_REVISION_EVENT_TYPES)[number];

export const TRANSLATION_FIELD_MAPPINGS = {
  property: {
    title: "titulo",
    description: "descripcion",
  },
  testimonial: {
    body: "texto",
  },
} as const;

const entityTypes = new Set<string>(TRANSLATION_ENTITY_TYPES);
const propertyFields = new Set<string>(PROPERTY_TRANSLATION_FIELDS);
const testimonialFields = new Set<string>(TESTIMONIAL_TRANSLATION_FIELDS);
const targetLocales = new Set<string>(TRANSLATION_TARGET_LOCALES);
const translationStatuses = new Set<string>(TRANSLATION_STATUSES);
const translationOrigins = new Set<string>(TRANSLATION_ORIGINS);
const reviewStatuses = new Set<string>(TRANSLATION_REVIEW_STATUSES);
const jobStatuses = new Set<string>(TRANSLATION_JOB_STATUSES);
const eventTypes = new Set<string>(TRANSLATION_REVISION_EVENT_TYPES);

export function isTranslationEntityType(
  value: unknown
): value is TranslationEntityType {
  return typeof value === "string" && entityTypes.has(value);
}

export function isPropertyTranslationField(
  value: unknown
): value is PropertyTranslationField {
  return typeof value === "string" && propertyFields.has(value);
}

export function isTestimonialTranslationField(
  value: unknown
): value is TestimonialTranslationField {
  return typeof value === "string" && testimonialFields.has(value);
}

export function isTranslationFieldForEntity(
  entityType: TranslationEntityType,
  value: unknown
): value is TranslationField {
  return entityType === "property"
    ? isPropertyTranslationField(value)
    : isTestimonialTranslationField(value);
}

export function isTranslationTargetLocale(
  value: unknown
): value is TranslationTargetLocale {
  return typeof value === "string" && targetLocales.has(value);
}

export function isTranslationStatus(
  value: unknown
): value is TranslationStatus {
  return typeof value === "string" && translationStatuses.has(value);
}

export function isTranslationOrigin(
  value: unknown
): value is TranslationOrigin {
  return typeof value === "string" && translationOrigins.has(value);
}

export function isTranslationReviewStatus(
  value: unknown
): value is TranslationReviewStatus {
  return typeof value === "string" && reviewStatuses.has(value);
}

export function isTranslationJobStatus(
  value: unknown
): value is TranslationJobStatus {
  return typeof value === "string" && jobStatuses.has(value);
}

export function isTranslationRevisionEventType(
  value: unknown
): value is TranslationRevisionEventType {
  return typeof value === "string" && eventTypes.has(value);
}

export function assertTranslationTargetLocale(
  value: unknown
): asserts value is TranslationTargetLocale {
  if (!isTranslationTargetLocale(value)) {
    throw new Error("Unsupported translation target locale.");
  }
}

export function assertTranslationFieldForEntity(
  entityType: TranslationEntityType,
  value: unknown
): asserts value is TranslationField {
  if (!isTranslationFieldForEntity(entityType, value)) {
    throw new Error("Translation field is not allowed for this entity.");
  }
}

export function isSupportedTranslationLocale(
  locale: AppLocale
): locale is TranslationTargetLocale {
  return isTranslationTargetLocale(locale);
}
