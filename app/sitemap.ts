import type { MetadataRoute } from "next";
import { connection } from "next/server";
import type { PropiedadQueryRow } from "@/lib/queries/propiedades";
import { isMultilingualEnabled } from "@/lib/i18n/locales";
import { getLocalizedSeoUrls, isCompleteEnglishPropertyTranslation, STATIC_SEO_COPY } from "@/lib/i18n/seo";
import { isPublishableTranslation } from "@/lib/i18n/translations/publishable";
import { createPostgresTranslationDatabase, createTranslationRepository } from "@/lib/i18n/translations/repository";
import { sql } from "@/lib/db";

export const revalidate = 3600;

const STATIC_SETTINGS = {
  home: { changeFrequency: "weekly", priority: 1 },
  listings: { changeFrequency: "daily", priority: 0.9 },
  contact: { changeFrequency: "monthly", priority: 0.8 },
  about: { changeFrequency: "monthly", priority: 0.7 },
  testimonials: { changeFrequency: "weekly", priority: 0.7 },
  privacy: { changeFrequency: "yearly", priority: 0.3 },
} as const;

function alternates(spanishPath: string) {
  return { languages: getLocalizedSeoUrls(spanishPath, "es-PR", true).languages! };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Generate from current catalog data on request. The cached public queries
  // below still limit Neon reads, while builds never contact production Neon.
  await connection();
  const multilingual = isMultilingualEnabled();
  const staticPages: MetadataRoute.Sitemap = [];
  for (const page of Object.keys(STATIC_SEO_COPY) as Array<keyof typeof STATIC_SEO_COPY>) {
    const definition = STATIC_SEO_COPY[page];
    const settings = STATIC_SETTINGS[page];
    const urls = getLocalizedSeoUrls(definition.path, "es-PR", multilingual);
    staticPages.push({
      url: urls.canonical,
      changeFrequency: settings.changeFrequency,
      priority: settings.priority,
      ...(multilingual ? { alternates: alternates(definition.path) } : {}),
    });
    if (multilingual && urls.englishPath) {
      staticPages.push({
        url: getLocalizedSeoUrls(definition.path, "en-US", true).canonical,
        changeFrequency: settings.changeFrequency,
        priority: settings.priority,
        alternates: alternates(definition.path),
      });
    }
  }

  let propiedades: PropiedadQueryRow[] = [];
  try {
    const { getPropiedades } = await import("@/lib/queries/propiedades");
    propiedades = await getPropiedades();
  } catch (error) {
    console.warn("sitemap_properties_unavailable", {
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
  }

  const spanishProperties: MetadataRoute.Sitemap = propiedades.map((item) => {
    const path = `/listados/${item.slug}`;
    return {
      url: getLocalizedSeoUrls(path, "es-PR", multilingual).canonical,
      lastModified: item.content_updated_at ? new Date(item.content_updated_at) : undefined,
      changeFrequency: "weekly",
      priority: item.destacado ? 0.8 : 0.6,
    };
  });

  if (!multilingual || propiedades.length === 0) {
    return [...staticPages, ...spanishProperties];
  }

  const repository = createTranslationRepository(createPostgresTranslationDatabase(sql));
  const translations = await repository.fetchPropertyTranslations(
    propiedades.map((property) => property.id),
    "en-US",
    ["title", "description"]
  );
  const coverage = new Map(translations.map((translation) => [
    `${translation.ownerId}:${translation.fieldKey}`,
    isPublishableTranslation(translation),
  ]));
  const completeIds = new Set(propiedades
    .filter((property) => isCompleteEnglishPropertyTranslation({
      titlePublishable: coverage.get(`${property.id}:title`) === true,
      descriptionPublishable: coverage.get(`${property.id}:description`) === true,
    })).map((property) => property.id));
  const localizedSpanishProperties = spanishProperties.map((entry, index) =>
    completeIds.has(propiedades[index].id)
      ? { ...entry, alternates: alternates(`/listados/${propiedades[index].slug}`) }
      : entry
  );
  const englishProperties: MetadataRoute.Sitemap = propiedades
    .filter((property) => completeIds.has(property.id))
    .map((item) => {
      const path = `/listados/${item.slug}`;
      return {
        url: getLocalizedSeoUrls(path, "en-US", true).canonical,
        lastModified: item.content_updated_at ? new Date(item.content_updated_at) : undefined,
        changeFrequency: "weekly" as const,
        priority: item.destacado ? 0.8 : 0.6,
        alternates: alternates(path),
      };
    });
  return [...staticPages, ...localizedSpanishProperties, ...englishProperties];
}
