import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  type AppLocale,
} from "@/lib/i18n/locales";

type RouteDefinition = {
  es: string;
  en: string;
};

export const LOCALIZED_ROUTE_DEFINITIONS = [
  { es: "/", en: "/en" },
  { es: "/listados", en: "/en/listings" },
  { es: "/listados/[slug]", en: "/en/listings/[slug]" },
  { es: "/about", en: "/en/about" },
  { es: "/contact", en: "/en/contact" },
  { es: "/testimonios", en: "/en/testimonials" },
  { es: "/privacidad", en: "/en/privacy" },
] as const satisfies readonly RouteDefinition[];

const SAFE_PUBLIC_QUERY_PARAMETERS = new Set([
  "q",
  "region",
  "municipio",
  "tipoNegocio",
  "tipoPropiedad",
  "precioMin",
  "precioMax",
  "habitaciones",
  "banos",
  "estado",
  "orden",
  "page",
]);

type Match = {
  definition: (typeof LOCALIZED_ROUTE_DEFINITIONS)[number];
  locale: AppLocale;
  params: Record<string, string>;
};

function normalizePathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function matchPattern(pattern: string, pathname: string) {
  const patternSegments = normalizePathname(pattern).split("/");
  const pathSegments = normalizePathname(pathname).split("/");

  if (patternSegments.length !== pathSegments.length) return null;

  const params: Record<string, string> = {};

  for (let index = 0; index < patternSegments.length; index += 1) {
    const patternSegment = patternSegments[index];
    const pathSegment = pathSegments[index];
    const parameter = patternSegment.match(/^\[([a-zA-Z][a-zA-Z0-9_]*)\]$/);

    if (parameter) {
      if (!pathSegment) return null;
      params[parameter[1]] = pathSegment;
      continue;
    }

    if (patternSegment !== pathSegment) return null;
  }

  return params;
}

function renderPattern(pattern: string, params: Record<string, string>) {
  return pattern.replace(
    /\[([a-zA-Z][a-zA-Z0-9_]*)\]/g,
    (_match, key: string) => params[key]
  );
}

function isExcludedPath(pathname: string) {
  return (
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    /^\/listados\/[^/]+\/visita\/[^/]+(?:\/|$)/.test(pathname)
  );
}

function findMatch(pathname: string): Match | null {
  const normalized = normalizePathname(pathname);

  if (isExcludedPath(normalized)) return null;

  for (const definition of LOCALIZED_ROUTE_DEFINITIONS) {
    const spanishParams = matchPattern(definition.es, normalized);
    if (spanishParams) {
      return { definition, locale: DEFAULT_LOCALE, params: spanishParams };
    }

    const englishParams = matchPattern(definition.en, normalized);
    if (englishParams) {
      return { definition, locale: ENGLISH_LOCALE, params: englishParams };
    }
  }

  return null;
}

function copySafeQueryParameters(source: URLSearchParams) {
  const target = new URLSearchParams();

  for (const [key, value] of source.entries()) {
    if (SAFE_PUBLIC_QUERY_PARAMETERS.has(key)) {
      target.append(key, value);
    }
  }

  return target;
}

export function getRouteLocale(pathname: string): AppLocale | null {
  if (!pathname.startsWith("/") || pathname.startsWith("//")) return null;
  return findMatch(pathname)?.locale ?? null;
}

export function isStaticLocalePreviewRoute(pathname: string) {
  const match = findMatch(pathname);
  if (!match) return false;

  return !match.definition.es.includes("[");
}

export function getEquivalentRoute(
  currentHref: string,
  targetLocale: AppLocale
): string | null {
  if (!currentHref.startsWith("/") || currentHref.startsWith("//")) return null;

  const current = new URL(currentHref, "https://borikipr.invalid");
  const match = findMatch(current.pathname);
  if (!match) return null;

  const targetPattern =
    targetLocale === DEFAULT_LOCALE ? match.definition.es : match.definition.en;
  const targetPath = renderPattern(targetPattern, match.params);
  const safeQuery = copySafeQueryParameters(current.searchParams).toString();

  return `${targetPath}${safeQuery ? `?${safeQuery}` : ""}${current.hash}`;
}

export function getEnabledEquivalentRoute(
  currentHref: string,
  targetLocale: AppLocale,
  enabled = false
) {
  return enabled ? getEquivalentRoute(currentHref, targetLocale) : null;
}
