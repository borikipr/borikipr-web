import { createHash } from "node:crypto";
import {
  TRANSLATION_SOURCE_LOCALE,
  assertTranslationFieldForEntity,
  isTranslationEntityType,
  type PropertyTranslationField,
  type TestimonialTranslationField,
  type TranslationEntityType,
  type TranslationField,
} from "@/lib/i18n/translations/types";

export const CURRENT_TRANSLATION_HASH_VERSION = 1;
export const TRANSLATION_HASH_HEX_LENGTH = 64;

export function normalizeTranslationSourceText(value: string) {
  return value.replace(/\r\n?/g, "\n").normalize("NFC");
}

type HashTranslationSourceInput = {
  entityType: TranslationEntityType;
  fieldKey: TranslationField;
  sourceText: string;
  hashVersion?: number;
};

export function hashTranslationSource({
  entityType,
  fieldKey,
  sourceText,
  hashVersion = CURRENT_TRANSLATION_HASH_VERSION,
}: HashTranslationSourceInput) {
  if (!isTranslationEntityType(entityType)) {
    throw new Error("Unsupported translation entity type.");
  }
  assertTranslationFieldForEntity(entityType, fieldKey);
  if (!Number.isInteger(hashVersion) || hashVersion <= 0) {
    throw new Error("Translation hash version must be a positive integer.");
  }

  const normalized = normalizeTranslationSourceText(sourceText);
  const canonical = [
    `borikipr-translation-sha256-v${hashVersion}`,
    entityType,
    fieldKey,
    TRANSLATION_SOURCE_LOCALE,
    normalized,
  ].join("\u0000");

  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

export function hashPropertyTranslationSource(
  fieldKey: PropertyTranslationField,
  sourceText: string,
  hashVersion = CURRENT_TRANSLATION_HASH_VERSION
) {
  return hashTranslationSource({
    entityType: "property",
    fieldKey,
    sourceText,
    hashVersion,
  });
}

export function hashTestimonialTranslationSource(
  fieldKey: TestimonialTranslationField,
  sourceText: string,
  hashVersion = CURRENT_TRANSLATION_HASH_VERSION
) {
  return hashTranslationSource({
    entityType: "testimonial",
    fieldKey,
    sourceText,
    hashVersion,
  });
}
