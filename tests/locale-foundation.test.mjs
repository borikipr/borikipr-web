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

test("minimal dictionaries share a complete shape and Spanish is the fallback", () => {
  assert.equal(getDictionary("es-PR").navigation.listings, "Listados");
  assert.equal(getDictionary("en-US").navigation.listings, "Listings");
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
    getEquivalentRoute(
      "/listados/casa-cotolaurel-ponce",
      ENGLISH_LOCALE
    ),
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
  assert.equal(
    getEnabledEquivalentRoute("/listados", "en-US", false),
    null
  );
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

test("existing Spanish shell, sitemap and redirect behavior remain untouched", async () => {
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
  assert.doesNotMatch(publicLayout, /LanguageSelector/);
  assert.doesNotMatch(header, /LanguageSelector|data-language-selector/);
  assert.match(environmentExample, /MULTILINGUAL_ENABLED=false/);
});

test("the hidden selector has accessible text and no analytics integration", async () => {
  const selector = await source("components/LanguageSelector.tsx");

  assert.match(selector, /enabled = false/);
  assert.match(selector, /if \(!enabled\) return null/);
  assert.match(selector, /Español/);
  assert.match(selector, /English/);
  assert.match(selector, /aria-hidden="true"/);
  assert.match(selector, /aria-label=/);
  assert.doesNotMatch(selector, /Analytics|trackAnalytics|privateToken/);
});
