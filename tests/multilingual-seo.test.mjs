import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  OPEN_GRAPH_LOCALES,
  buildPropertySeoMetadata,
  buildStaticPageMetadata,
  getLocalizedSeoUrls,
  isCompleteEnglishPropertyTranslation,
  normalizeMetadataDescription,
} from "../lib/i18n/seo.ts";
import { isPublishableTranslation } from "../lib/i18n/translations/publishable.ts";
import { realEstateAgentJsonLdForLocale } from "../lib/seo.ts";

const source = (path) => readFile(fileURLToPath(new URL(path, import.meta.url)), "utf8");

test("localized URL helpers produce absolute self-canonicals and justified alternates", () => {
  const spanish = getLocalizedSeoUrls("/listados/casa-ponce", "es-PR", true);
  const english = getLocalizedSeoUrls("/listados/casa-ponce", "en-US", true);
  assert.equal(spanish.canonical, "https://borikipr.com/listados/casa-ponce");
  assert.equal(english.canonical, "https://borikipr.com/en/listings/casa-ponce");
  assert.equal(english.languages["es-PR"], spanish.canonical);
  assert.equal(english.languages["en-US"], english.canonical);
  assert.equal(english.languages["x-default"], spanish.canonical);
  assert.equal(getLocalizedSeoUrls("/about", "es-PR", false).languages, undefined);
});

test("Open Graph locales use underscore notation", () => {
  assert.deepEqual(OPEN_GRAPH_LOCALES, { "es-PR": "es_PR", "en-US": "en_US" });
});

test("metadata descriptions normalize whitespace and truncate by Unicode code point", () => {
  assert.equal(normalizeMetadataDescription(" Uno\r\n  dos \t tres "), "Uno dos tres");
  const result = normalizeMetadataDescription(`${"á".repeat(158)} 😀 final`, 160);
  assert(!result.includes("\ud83d") || result.includes("😀"));
  assert(Array.from(result).length <= 160);
  assert(result.endsWith("…"));
});

test("static metadata is self-canonical, localized, and gated", () => {
  const es = buildStaticPageMetadata("about", "es-PR", true);
  const en = buildStaticPageMetadata("about", "en-US", true);
  const disabled = buildStaticPageMetadata("about", "es-PR", false);
  assert.equal(es.alternates.canonical, "https://borikipr.com/about");
  assert.equal(en.alternates.canonical, "https://borikipr.com/en/about");
  assert.equal(en.openGraph.locale, "en_US");
  assert.deepEqual(en.openGraph.alternateLocale, ["es_PR"]);
  assert.equal(en.openGraph.url, en.alternates.canonical);
  assert.match(en.title, /Ivonne Erickson/);
  assert.equal(disabled.alternates.languages, undefined);
  assert.equal(disabled.openGraph.alternateLocale, undefined);
});

test("dynamic English property coverage controls robots without changing canonical", () => {
  const complete = buildPropertySeoMetadata({
    locale: "en-US", slug: "casa-ponce", title: "House in Ponce",
    description: "A property in Ponce.", englishCoverageComplete: true,
    multilingualEnabled: true,
  });
  const incomplete = buildPropertySeoMetadata({
    locale: "en-US", slug: "casa-ponce", title: "Casa en Ponce",
    description: "Propiedad en Ponce.", englishCoverageComplete: false,
    multilingualEnabled: true,
  });
  assert.deepEqual(complete.robots, { index: true, follow: true });
  assert.deepEqual(incomplete.robots, { index: false, follow: true });
  assert.equal(incomplete.alternates.canonical, "https://borikipr.com/en/listings/casa-ponce");
  assert.equal(incomplete.openGraph.url, incomplete.alternates.canonical);
  assert.equal(complete.openGraph.type, "article");
  assert.equal(complete.openGraph.images[0].url, "https://borikipr.com/og-image.jpg");
  const spanish = buildPropertySeoMetadata({
    locale: "es-PR", slug: "casa-ponce", title: "Casa en Ponce",
    description: "Propiedad en Ponce.", englishCoverageComplete: false,
    multilingualEnabled: false,
  });
  assert.deepEqual(spanish.robots, { index: true, follow: true });
  assert.equal(spanish.alternates.languages, undefined);
});

test("publishability and completeness reject stale, failed, empty, or mismatched translations", () => {
  const ready = { status: "ready", translatedValue: "Ready", sourceHash: "a", translatedSourceHash: "a" };
  assert.equal(isPublishableTranslation(ready), true);
  for (const candidate of [
    { ...ready, status: "stale" }, { ...ready, status: "failed" },
    { ...ready, translatedValue: " " }, { ...ready, translatedSourceHash: "b" },
  ]) assert.equal(isPublishableTranslation(candidate), false);
  assert.equal(isCompleteEnglishPropertyTranslation({ titlePublishable: true, descriptionPublishable: true }), true);
  assert.equal(isCompleteEnglishPropertyTranslation({ titlePublishable: true, descriptionPublishable: false }), false);
});

test("business structured-data identity is stable while editorial job title localizes", () => {
  const es = realEstateAgentJsonLdForLocale("es-PR");
  const en = realEstateAgentJsonLdForLocale("en-US");
  assert.equal(es["@id"], en["@id"]);
  assert.equal(es.name, en.name);
  assert.equal(es.founder.name, "Ivonne Erickson");
  assert.equal(en.founder.jobTitle, "Real Estate Broker");
});

test("English property metadata and JSON-LD use localized routes without provider or internal state", async () => {
  const property = await source("../app/(public)/listados/[slug]/page.tsx");
  const english = await source("../app/(public)/en/listings/[slug]/page.tsx");
  assert.match(english, /generateLocalizedPropertyMetadata\(params, ENGLISH_LOCALE\)/);
  assert.match(property, /getLocalizedPropertyDetail = cache/);
  assert.match(property, /name: propiedad\.titulo/);
  assert.match(property, /description: propiedad\.descripcion/);
  assert.match(property, /url: propiedadUrl/);
  assert.match(property, /#real-estate-agent/);
  assert.doesNotMatch(property, /provider_model|review_status|source_hash|translation_jobs/);
});

test("sitemap batches coverage, excludes incomplete English properties, and disabled mode returns before translation reads", async () => {
  const sitemap = await source("../app/sitemap.ts");
  assert.match(sitemap, /if \(!multilingual \|\| propiedades\.length === 0\)/);
  assert.match(sitemap, /fetchPropertyTranslations\(/);
  assert.match(sitemap, /propiedades\.map\(\(property\) => property\.id\)/);
  assert.match(sitemap, /completeIds/);
  assert.match(sitemap, /filter\(\(property\) => completeIds\.has\(property\.id\)\)/);
  assert.doesNotMatch(sitemap, /privateToken|\/admin|\/api/);
});

test("robots keeps public English crawlable and uses metadata for incomplete-property noindex", async () => {
  const robots = await source("../app/robots.ts");
  assert.match(robots, /allow: "\/"/);
  assert.doesNotMatch(robots, /disallow:.*\/en/i);
  assert.match(robots, /\/admin\//);
  assert.match(robots, /\/api\//);
  assert.match(robots, /https:\/\/borikipr\.com\/sitemap\.xml/);
});

test("all English static wrappers own localized metadata and Spanish pages use the shared helper", async () => {
  const pairs = [
    ["../app/(public)/page.tsx", "../app/(public)/en/page.tsx", "home"],
    ["../app/(public)/about/page.tsx", "../app/(public)/en/about/page.tsx", "about"],
    ["../app/(public)/contact/page.tsx", "../app/(public)/en/contact/page.tsx", "contact"],
    ["../app/(public)/listados/page.tsx", "../app/(public)/en/listings/page.tsx", "listings"],
    ["../app/(public)/testimonios/page.tsx", "../app/(public)/en/testimonials/page.tsx", "testimonials"],
    ["../app/(public)/privacidad/page.tsx", "../app/(public)/en/privacy/page.tsx", "privacy"],
  ];
  for (const [spanishPath, englishPath, key] of pairs) {
    assert.match(await source(spanishPath), new RegExp(`buildStaticPageMetadata\\("${key}", DEFAULT_LOCALE\\)`));
    assert.match(await source(englishPath), new RegExp(`buildStaticPageMetadata\\("${key}", ENGLISH_LOCALE\\)`));
  }
});

test("SEO work does not alter robots exclusions, transactional routes, analytics, or provider execution", async () => {
  const changedContracts = await Promise.all([
    source("../app/robots.ts"), source("../lib/i18n/seo.ts"), source("../app/sitemap.ts"),
  ]);
  const joined = changedContracts.join("\n");
  assert.doesNotMatch(joined, /translateText|GoogleCloudTranslation|processTranslationJobs|CRON_SECRET/);
  assert.doesNotMatch(joined, /registro-openhouse|perfil-comprador|privateToken/);
});
