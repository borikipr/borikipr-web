import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  SUPPORTED_LOCALES,
  isMultilingualEnabled,
  isSupportedLocale,
} from "../lib/i18n/locales.ts";
import {
  getEnabledEquivalentRoute,
  getEquivalentRoute,
  getRouteLocale,
  isStaticLocalePreviewRoute,
} from "../lib/i18n/routing.ts";
import {
  getDictionary,
  getDictionaryForUnknownLocale,
} from "../lib/i18n/get-dictionary.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("supported locales are typed around es-PR and en-US with Spanish as default", () => {
  assert.deepEqual(SUPPORTED_LOCALES, ["es-PR", "en-US"]);
  assert.equal(DEFAULT_LOCALE, "es-PR");
  assert.equal(ENGLISH_LOCALE, "en-US");
  assert.equal(isSupportedLocale("es-PR"), true);
  assert.equal(isSupportedLocale("en-US"), true);
  assert.equal(isSupportedLocale("en"), false);
});

test("expanded dictionaries share a complete shape and Spanish is the fallback", () => {
  assert.equal(getDictionary("es-PR").navigation.listings, "Listados");
  assert.equal(getDictionary("en-US").navigation.listings, "Listings");
  assert.equal(
    getDictionary("es-PR").home.hero.exploreListings,
    "Explorar listados"
  );
  assert.equal(
    getDictionary("en-US").home.hero.exploreListings,
    "Explore listings"
  );
  assert.equal(getDictionary("en-US").footer.servicesHeading, "Services");
  assert.equal(getDictionary("en-US").notFound.homeAction, "Return home");
  assert.equal(
    getDictionaryForUnknownLocale(undefined).language.spanish,
    "Español"
  );
});

test("unsupported locales fail clearly outside production", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";

  try {
    assert.throws(
      () => getDictionaryForUnknownLocale("fr-FR"),
      /Unsupported locale/
    );
  } finally {
    process.env.NODE_ENV = originalNodeEnv;
  }
});

test("equivalent route mapping preserves the property slug", () => {
  assert.equal(
    getEquivalentRoute("/listados/casa-cotolaurel-ponce", ENGLISH_LOCALE),
    "/en/listings/casa-cotolaurel-ponce"
  );
  assert.equal(
    getEquivalentRoute(
      "/en/listings/casa-cotolaurel-ponce",
      DEFAULT_LOCALE
    ),
    "/listados/casa-cotolaurel-ponce"
  );
});

test("static route equivalents map in both directions", () => {
  assert.equal(getEquivalentRoute("/listados", "en-US"), "/en/listings");
  assert.equal(getEquivalentRoute("/en/testimonials", "es-PR"), "/testimonios");
  assert.equal(getEquivalentRoute("/privacidad", "en-US"), "/en/privacy");
  assert.equal(getEquivalentRoute("/en/about", "es-PR"), "/about");
});

test("round-trip locale switching preserves route, slug, query, and fragment", () => {
  const spanish =
    "/listados/casa-cotolaurel-ponce?region=sur&page=2#detalles";
  const english = getEquivalentRoute(spanish, "en-US");

  assert.equal(
    english,
    "/en/listings/casa-cotolaurel-ponce?region=sur&page=2#detalles"
  );
  assert.equal(getEquivalentRoute(english, "es-PR"), spanish);
});

test("only safe public query parameters are preserved", () => {
  assert.equal(
    getEquivalentRoute(
      "/listados?region=sur&page=2&q=Ponce&privateToken=secret",
      "en-US"
    ),
    "/en/listings?region=sur&page=2&q=Ponce"
  );
});

test("feature flag defaults to disabled and accepts only explicit true", () => {
  assert.equal(isMultilingualEnabled(undefined), false);
  assert.equal(isMultilingualEnabled("false"), false);
  assert.equal(isMultilingualEnabled("1"), false);
  assert.equal(isMultilingualEnabled(" TRUE "), true);
  assert.equal(getEnabledEquivalentRoute("/listados", "en-US", false), null);
});

test("admin, API, private-token and transactional routes are not remapped", () => {
  assert.equal(getEquivalentRoute("/admin/leads", "en-US"), null);
  assert.equal(getEquivalentRoute("/api/track", "en-US"), null);
  assert.equal(
    getEquivalentRoute("/listados/casa/visita/private-secret", "en-US"),
    null
  );
  assert.equal(
    getEquivalentRoute("/listados/casa/perfil-comprador", "en-US"),
    null
  );
  assert.equal(getRouteLocale("/admin"), null);
});

test("Phase 2 selector is limited to static routes while property previews are deferred", () => {
  assert.equal(isStaticLocalePreviewRoute("/"), true);
  assert.equal(isStaticLocalePreviewRoute("/en/about"), true);
  assert.equal(isStaticLocalePreviewRoute("/listados/casa-cotolaurel-ponce"), false);
  assert.equal(isStaticLocalePreviewRoute("/admin"), false);
  assert.equal(
    isStaticLocalePreviewRoute("/listados/casa/visita/private-secret"),
    false
  );
});

test("Spanish shell, sitemap and redirect behavior remain stable while locale UI is gated", async () => {
  const [layout, sitemap, nextConfig, publicLayout, header, environmentExample] =
    await Promise.all([
      source("app/layout.tsx"),
      source("app/sitemap.ts"),
      source("next.config.ts"),
      source("app/(public)/layout.tsx"),
      source("components/Header.tsx"),
      source(".env.example"),
    ]);

  assert.match(layout, /<html lang="es"/);
  assert.doesNotMatch(layout, /hreflang|languages:/);
  assert.doesNotMatch(sitemap, /\/en(?:\/|`|")/);
  assert.doesNotMatch(nextConfig, /Accept-Language|MULTILINGUAL_ENABLED/);
  assert.match(publicLayout, /isMultilingualEnabled\(\)/);
  assert.match(publicLayout, /PublicLocaleProvider/);
  assert.match(header, /multilingualEnabled && <LanguageSelector/);
  assert.match(environmentExample, /MULTILINGUAL_ENABLED=false/);
});

test("the feature-gated selector is accessible and has no analytics integration", async () => {
  const selector = await source("components/LanguageSelector.tsx");

  assert.match(selector, /dictionary\.language\.selectorLabel/);
  assert.match(selector, /dictionary\.language\.spanish/);
  assert.match(selector, /dictionary\.language\.english/);
  assert.match(selector, /🇵🇷/);
  assert.match(selector, /🇺🇸/);
  assert.match(selector, /aria-hidden="true"/);
  assert.match(selector, /aria-label=/);
  assert.doesNotMatch(selector, /Analytics|trackAnalytics|privateToken/);
});

test("English preview routes are gated by the server-side feature flag", async () => {
  const [englishLayout, englishHome, englishAbout, englishListings] =
    await Promise.all([
      source("app/(public)/en/layout.tsx"),
      source("app/(public)/en/page.tsx"),
      source("app/(public)/en/about/page.tsx"),
      source("app/(public)/en/listings/page.tsx"),
    ]);

  assert.match(englishLayout, /isMultilingualEnabled\(\)/);
  assert.match(englishLayout, /notFound\(\)/);
  assert.match(englishHome, /renderHomePage\(ENGLISH_LOCALE\)/);
  assert.match(englishAbout, /from "\.\.\/\.\.\/about\/page"/);
  assert.match(englishListings, /from "\.\.\/\.\.\/listados\/page"/);
});

test("locale provider changes html lang only while multilingual mode is active", async () => {
  const provider = await source("components/PublicLocaleProvider.tsx");

  assert.match(provider, /if \(!multilingualEnabled\) return/);
  assert.match(provider, /document\.documentElement\.lang = locale/);
  assert.match(provider, /document\.documentElement\.lang = "es"/);
  assert.match(provider, /getRouteLocale\(pathname\)/);
});

test("Home, Header and Footer consume shared static dictionaries", async () => {
  const [home, hero, header, footer] = await Promise.all([
    source("app/(public)/page.tsx"),
    source("components/HomeHeroClient.tsx"),
    source("components/Header.tsx"),
    source("components/Footer.tsx"),
  ]);

  assert.match(home, /getDictionary\(locale\)/);
  assert.match(home, /copy\.reasons\.title/);
  assert.match(home, /copy\.listings\.title/);
  assert.match(home, /copy\.cta\.title/);
  assert.match(hero, /dictionary\.home\.hero/);
  assert.match(header, /dictionary\.navigation\.home/);
  assert.match(footer, /dictionary\.footer\.brandDescription/);
});

test("localized 404s exist without locale redirects", async () => {
  const [spanishNotFound, englishNotFound, missingEnglish, nextConfig] =
    await Promise.all([
      source("app/not-found.tsx"),
      source("app/(public)/en/not-found.tsx"),
      source("app/(public)/en/[...missing]/page.tsx"),
      source("next.config.ts"),
    ]);

  assert.match(spanishNotFound, /DEFAULT_LOCALE/);
  assert.match(englishNotFound, /ENGLISH_LOCALE/);
  assert.match(missingEnglish, /notFound\(\)/);
  assert.doesNotMatch(nextConfig, /Accept-Language|localeDetection/);
});
