import type { Metadata } from "next";
import { DEFAULT_LOCALE, ENGLISH_LOCALE, isMultilingualEnabled, type AppLocale } from "@/lib/i18n/locales";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { DEFAULT_OG_IMAGE, SITE_NAME, absoluteUrl } from "@/lib/seo";

export const OPEN_GRAPH_LOCALES: Record<AppLocale, "es_PR" | "en_US"> = {
  "es-PR": "es_PR",
  "en-US": "en_US",
};

export const STATIC_SEO_COPY = {
  home: {
    path: "/",
    es: { title: "Bienes Raíces en Puerto Rico", description: "Compra, vende o invierte en Puerto Rico con orientación clara, estrategia y acompañamiento profesional." },
    en: { title: "Real Estate in Puerto Rico", description: "Buy, sell, or invest in Puerto Rico with clear guidance, strategy, and professional support." },
  },
  about: {
    path: "/about",
    es: { title: "Sobre Ivonne Erickson", description: "Conoce el enfoque de Ivonne Erickson para guiar decisiones inmobiliarias en Puerto Rico con estrategia, claridad y acompañamiento profesional." },
    en: { title: "About Ivonne Erickson", description: "Learn how Ivonne Erickson guides real estate decisions in Puerto Rico with strategy, clarity, and professional support." },
  },
  contact: {
    path: "/contact",
    es: { title: "Contacto", description: "Comunícate con Erickson Real Estate para recibir orientación sobre comprar, alquilar, vender o invertir en Puerto Rico." },
    en: { title: "Contact", description: "Contact Erickson Real Estate for guidance on buying, renting, selling, or investing in Puerto Rico." },
  },
  listings: {
    path: "/listados",
    es: { title: "Listados de Propiedades", description: "Explora propiedades en venta y alquiler en Puerto Rico con información clara, filtros útiles y orientación profesional." },
    en: { title: "Property Listings", description: "Explore properties for sale and rent in Puerto Rico with clear information, useful filters, and professional guidance." },
  },
  testimonials: {
    path: "/testimonios",
    es: { title: "Testimonios", description: "Lee experiencias de clientes que han recibido orientación inmobiliaria clara, estrategia y acompañamiento profesional con Ivonne Erickson." },
    en: { title: "Testimonials", description: "Read client experiences with Ivonne Erickson's clear real estate guidance, strategy, and professional support." },
  },
  privacy: {
    path: "/privacidad",
    es: { title: "Privacidad", description: "Información sobre el uso y la protección de datos en BorikíPR y Erickson Real Estate." },
    en: { title: "Privacy", description: "Information about data use and protection at BorikíPR and Erickson Real Estate." },
  },
} as const;

export type StaticSeoPage = keyof typeof STATIC_SEO_COPY;

export function normalizeMetadataDescription(value: string, maximum = 160) {
  const normalized = value.normalize("NFC").replace(/\s+/gu, " ").trim();
  const characters = Array.from(normalized);
  if (characters.length <= maximum) return normalized;
  const shortened = characters.slice(0, Math.max(1, maximum - 1)).join("");
  const lastSpace = shortened.lastIndexOf(" ");
  return `${(lastSpace >= Math.floor(maximum * 0.6) ? shortened.slice(0, lastSpace) : shortened).trimEnd()}…`;
}

export function getLocalizedSeoUrls(spanishPath: string, locale: AppLocale, enabled = isMultilingualEnabled()) {
  const spanish = getEquivalentRoute(spanishPath, DEFAULT_LOCALE) ?? spanishPath;
  const english = getEquivalentRoute(spanishPath, ENGLISH_LOCALE);
  const activePath = locale === ENGLISH_LOCALE && english ? english : spanish;
  const languages: Record<string, string> | undefined = enabled && english
    ? { "es-PR": absoluteUrl(spanish), "en-US": absoluteUrl(english), "x-default": absoluteUrl(spanish) }
    : undefined;
  return { canonical: absoluteUrl(activePath), activePath, spanishPath: spanish, englishPath: english, languages };
}

export function buildLocalizedMetadata(input: {
  locale: AppLocale;
  spanishPath: string;
  title: string;
  socialTitle?: string;
  description: string;
  image?: string | null;
  imageAlt?: string;
  indexable?: boolean;
  openGraphType?: "website" | "article";
  multilingualEnabled?: boolean;
}): Metadata {
  const enabled = input.multilingualEnabled ?? isMultilingualEnabled();
  const urls = getLocalizedSeoUrls(input.spanishPath, input.locale, enabled);
  const description = normalizeMetadataDescription(input.description);
  const image = input.image ? absoluteUrl(input.image) : DEFAULT_OG_IMAGE;
  const alternateLocale = input.locale === DEFAULT_LOCALE ? OPEN_GRAPH_LOCALES[ENGLISH_LOCALE] : OPEN_GRAPH_LOCALES[DEFAULT_LOCALE];
  return {
    title: input.title,
    description,
    alternates: { canonical: urls.canonical, ...(urls.languages ? { languages: urls.languages } : {}) },
    robots: input.indexable === false ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: {
      title: input.socialTitle ?? input.title,
      description,
      url: urls.canonical,
      siteName: SITE_NAME,
      locale: OPEN_GRAPH_LOCALES[input.locale],
      ...(enabled ? { alternateLocale: [alternateLocale] } : {}),
      type: input.openGraphType ?? "website",
      images: [{ url: image, width: 1200, height: 630, alt: input.imageAlt ?? input.title }],
    },
    twitter: { card: "summary_large_image", title: input.socialTitle ?? input.title, description, images: [image] },
  };
}

export function buildStaticPageMetadata(page: StaticSeoPage, locale: AppLocale, multilingualEnabled?: boolean) {
  const definition = STATIC_SEO_COPY[page];
  const copy = locale === ENGLISH_LOCALE ? definition.en : definition.es;
  return buildLocalizedMetadata({
    locale, spanishPath: definition.path, ...copy, multilingualEnabled,
    ...(page === "home" ? { socialTitle: `${SITE_NAME} | ${copy.title}` } : {}),
  });
}

export function isCompleteEnglishPropertyTranslation(input: { titlePublishable: boolean; descriptionPublishable: boolean }) {
  return input.titlePublishable && input.descriptionPublishable;
}

export function buildPropertySeoMetadata(input: {
  locale: AppLocale;
  slug: string;
  title: string;
  description: string;
  image?: string | null;
  englishCoverageComplete: boolean;
  multilingualEnabled?: boolean;
}) {
  return buildLocalizedMetadata({
    locale: input.locale,
    spanishPath: `/listados/${input.slug}`,
    title: input.title,
    description: input.description,
    image: input.image,
    imageAlt: input.title,
    indexable: input.locale !== ENGLISH_LOCALE || input.englishCoverageComplete,
    openGraphType: "article",
    multilingualEnabled: input.multilingualEnabled,
  });
}
