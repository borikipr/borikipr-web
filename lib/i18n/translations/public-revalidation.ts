import { isMultilingualEnabled } from "@/lib/i18n/locales";
import type { TranslationEntityType } from "@/lib/i18n/translations/types";

export type TranslationPublicationTarget = {
  entityType: TranslationEntityType;
  ownerId: string;
  propertySlug?: string | null;
};

export function getEnglishPublicTranslationPaths(
  target: TranslationPublicationTarget
) {
  if (target.entityType === "testimonial") {
    return ["/en", "/en/testimonials"];
  }

  return [
    "/en",
    "/en/listings",
    "/sitemap.xml",
    ...(target.propertySlug ? [`/en/listings/${target.propertySlug}`] : []),
  ];
}

export async function invalidateEnglishPublicTranslationPaths(input: {
  target: TranslationPublicationTarget;
  revalidate: (path: string) => void | Promise<void>;
  multilingualEnabled?: boolean;
}) {
  const enabled =
    input.multilingualEnabled ?? isMultilingualEnabled();
  if (!enabled) return [];

  const paths = getEnglishPublicTranslationPaths(input.target);
  for (const path of paths) await input.revalidate(path);
  return paths;
}
