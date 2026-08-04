import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  PUBLIC_LOCALE_REQUEST_HEADER,
  SUPPORTED_LOCALES,
  getPublicRequestLocale,
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
import { getPublicFormText, hasEnglishPublicFormText } from "../lib/i18n/public-form-copy.ts";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

function dictionaryShape(value) {
  if (Array.isArray(value)) {
    return value.map(dictionaryShape);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, dictionaryShape(nested)])
    );
  }

  return typeof value;
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
  assert.equal(getDictionary("es-PR").gallery.open, "Abrir galería");
  assert.equal(getDictionary("en-US").gallery.open, "Open gallery");
  assert.equal(getDictionary("en-US").gallery.viewImage, "View image");
  assert.equal(getDictionary("en-US").notFound.homeAction, "Return home");
  assert.equal(
    getDictionaryForUnknownLocale(undefined).language.spanish,
    "Español"
  );
});

test("Phase 2.5 dictionaries have exact key and collection parity", () => {
  assert.deepEqual(
    dictionaryShape(getDictionary("en-US")),
    dictionaryShape(getDictionary("es-PR"))
  );
  assert.equal(getDictionary("es-PR").about.hero.eyebrow, "Sobre mí");
  assert.equal(getDictionary("en-US").about.hero.eyebrow, "About me");
  assert.equal(getDictionary("es-PR").contactHub.title, "¿Cómo puedo orientarte?");
  assert.equal(getDictionary("en-US").contactHub.title, "How can I guide you?");
  assert.equal(
    getDictionary("es-PR").listingsPage.title,
    "Propiedades en venta y alquiler"
  );
  assert.equal(
    getDictionary("en-US").listingsPage.title,
    "Properties for sale and rent"
  );
  assert.equal(
    getDictionary("en-US").testimonialsPage.filters.buyers,
    "Buyers"
  );
  assert.equal(
    getDictionary("en-US").testimonialsPage.featuredTag,
    "Featured testimonial"
  );
  assert.equal(
    getDictionary("en-US").testimonialsPage.sellerTitle,
    "Sale completed"
  );
  assert.equal(
    getDictionary("es-PR").testimonialsPage.featuredTag,
    "Testimonio destacado"
  );
  assert.equal(
    getDictionary("en-US").privacyPage.sections.length,
    getDictionary("es-PR").privacyPage.sections.length
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

test("server request locales are added only for enabled public routes", () => {
  assert.equal(PUBLIC_LOCALE_REQUEST_HEADER, "x-boriki-public-locale");
  assert.equal(getPublicRequestLocale("/about", false), null);
  assert.equal(getPublicRequestLocale("/about", true), "es-PR");
  assert.equal(getPublicRequestLocale("/en", true), "en-US");
  assert.equal(getPublicRequestLocale("/en/about", true), "en-US");
  assert.equal(getPublicRequestLocale("/admin/leads", true), null);
  assert.equal(getPublicRequestLocale("/api/track", true), null);
});

test("admin, API and private-token routes remain excluded while approved public forms are localized", () => {
  assert.equal(getEquivalentRoute("/admin/leads", "en-US"), null);
  assert.equal(getEquivalentRoute("/api/track", "en-US"), null);
  assert.equal(
    getEquivalentRoute("/listados/casa/visita/private-secret", "en-US"),
    null
  );
  assert.equal(getEquivalentRoute("/listados/casa/perfil-comprador", "en-US"), "/en/listings/casa/buyer-profile");
  assert.equal(getEquivalentRoute("/contact/compradores-arrendatarios", "en-US"), "/en/contact/buyers-tenants");
  assert.equal(getEquivalentRoute("/contact/vendedor-arrendador", "en-US"), "/en/contact/seller-landlord");
  assert.equal(getEquivalentRoute("/properties/casa/registro-prioritario", "en-US"), "/en/listings/casa/priority-registration");
  assert.equal(getRouteLocale("/admin"), null);
});

test("route classification distinguishes static, dynamic property, and excluded routes", () => {
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
  const [
    layout,
    sitemap,
    nextConfig,
    publicLayout,
    header,
    proxy,
    environmentExample,
  ] =
    await Promise.all([
      source("app/layout.tsx"),
      source("app/sitemap.ts"),
      source("next.config.ts"),
      source("app/(public)/layout.tsx"),
      source("components/Header.tsx"),
      source("proxy.ts"),
      source(".env.example"),
    ]);

  assert.match(layout, /let documentLanguage = "es"/);
  assert.match(layout, /PUBLIC_LOCALE_REQUEST_HEADER/);
  assert.match(layout, /<html lang=\{documentLanguage\}/);
  assert.doesNotMatch(layout, /hreflang|languages:/);
  assert.doesNotMatch(sitemap, /\/en(?:\/|`|")/);
  assert.doesNotMatch(nextConfig, /Accept-Language|MULTILINGUAL_ENABLED/);
  assert.match(publicLayout, /isMultilingualEnabled\(\)/);
  assert.match(publicLayout, /PublicLocaleProvider/);
  assert.match(header, /multilingualEnabled && <GuardedLanguageSelector/);
  assert.match(header, /<Suspense fallback=\{<LanguageSelectorFallback \/>/);
  assert.match(proxy, /getPublicRequestLocale\(pathname\)/);
  assert.match(proxy, /PUBLIC_LOCALE_REQUEST_HEADER/);
  assert.match(proxy, /adminMiddleware\(request\)/);
  assert.match(environmentExample, /MULTILINGUAL_ENABLED=false/);
});

test("the feature-gated selector is accessible and has no analytics integration", async () => {
  const [selector, puertoRicoFlag, unitedStatesFlag] = await Promise.all([
    source("components/LanguageSelector.tsx"),
    source("public/flags/puerto-rico.svg"),
    source("public/flags/united-states.svg"),
  ]);

  assert.match(selector, /dictionary\.language\.selectorLabel/);
  assert.match(selector, /dictionary\.language\.spanish/);
  assert.match(selector, /dictionary\.language\.english/);
  assert.match(selector, /\/flags\/puerto-rico\.svg/);
  assert.match(selector, /\/flags\/united-states\.svg/);
  assert.match(selector, /<Image/);
  assert.match(puertoRicoFlag, /aria-label="Puerto Rico"/);
  assert.match(unitedStatesFlag, /aria-label="United States"/);
  assert.doesNotMatch(selector, /flag:\s*["'](?:PR|US|🇵🇷|🇺🇸)/);
  assert.doesNotMatch(selector, /\(\{shortCode\}\)/);
  assert.match(selector, /aria-hidden="true"/);
  assert.match(selector, /aria-label=/);
  assert.match(selector, /getEquivalentRoute\(currentHref, option\.locale\)/);
  assert.doesNotMatch(selector, /isStaticLocalePreviewRoute/);
  assert.doesNotMatch(selector, /Analytics|trackAnalytics|privateToken/);
});

test("testimonial presentation derives every badge and title from locale copy", async () => {
  const [client, queries] = await Promise.all([
    source("app/(public)/testimonios/TestimoniosClientPage.tsx"),
    source("lib/queries/testimonios.ts"),
  ]);

  assert.match(client, /item\.destacado \? copy\.featuredTag : copy\.defaultTag/);
  assert.match(client, /item\.tipo === "comprador" \? copy\.buyerTitle : copy\.sellerTitle/);
  assert.match(client, /expanded \? copy\.readLess : copy\.readMore/);
  assert.doesNotMatch(client, /item\.etiqueta \|\|/);
  assert.doesNotMatch(client, /item\.titulo \|\|/);
  assert.doesNotMatch(queries, /Testimonio destacado|Experiencia real|Compra completada|Venta completada/);
});

test("public form copy localizes labels and errors while preserving canonical values", () => {
  assert.equal(getPublicFormText("es-PR", "Financiamiento"), "Financiamiento");
  assert.equal(getPublicFormText("en-US", "Financiamiento"), "Financing");
  assert.equal(getPublicFormText("en-US", "Adjunta la carta de precalificación requerida."), "Attach the required prequalification letter.");
  assert.equal(hasEnglishPublicFormText("Gracias. Tu solicitud fue enviada correctamente y nos comunicaremos pronto."), true);
});

test("every literal passed through the public form translator has reviewed English copy", async () => {
  const formSources = await Promise.all([
    source("components/FormularioComprador.tsx"),
    source("components/FormularioVendedor.tsx"),
    source("components/FormularioPerfilComprador.tsx"),
    source("components/PerfilCompradorPropiedadForm.tsx"),
    source("components/RegistroPrioritarioForm.tsx"),
    source("app/(public)/contact/compradores-arrendatarios/page.tsx"),
    source("app/(public)/contact/vendedor-arrendador/page.tsx"),
    source("app/(public)/contact/perfil-comprador/page.tsx"),
    source("app/(public)/listados/[slug]/perfil-comprador/page.tsx"),
    source("app/(public)/listados/[slug]/registro-openhouse/page.tsx"),
    source("app/(public)/properties/[slug]/registro-prioritario/page.tsx"),
  ]);

  const literals = formSources.flatMap((contents) =>
    [...contents.matchAll(/\bt\("((?:[^"\\]|\\.)*)"\)/g)].map((match) =>
      JSON.parse(`"${match[1]}"`)
    )
  );
  const missing = [...new Set(literals.filter((value) => !hasEnglishPublicFormText(value)))];

  assert.deepEqual(missing, []);
});

test("approved English form routes exist behind the English layout gate", async () => {
  const routes = await Promise.all([
    source("app/(public)/en/contact/buyer-profile/page.tsx"),
    source("app/(public)/en/contact/buyers-tenants/page.tsx"),
    source("app/(public)/en/contact/seller-landlord/page.tsx"),
    source("app/(public)/en/listings/[slug]/buyer-profile/page.tsx"),
    source("app/(public)/en/listings/[slug]/open-house-registration/page.tsx"),
    source("app/(public)/en/listings/[slug]/priority-registration/page.tsx"),
  ]);
  for (const route of routes) assert.match(route, /ENGLISH_LOCALE/);
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

test("locale provider synchronizes client navigation without owning initial html lang", async () => {
  const provider = await source("components/PublicLocaleProvider.tsx");

  assert.match(provider, /if \(!multilingualEnabled\) return/);
  assert.match(provider, /document\.documentElement\.lang = locale/);
  assert.doesNotMatch(provider, /document\.documentElement\.lang = "es"/);
  assert.doesNotMatch(provider, /return \(\) =>/);
  assert.match(provider, /getRouteLocale\(pathname\)/);
});

test("Home, Header and Footer consume shared static dictionaries", async () => {
  const [home, hero, header, footer] = await Promise.all([
    source("app/(public)/page.tsx"),
    source("components/HomeHeroClient.tsx"),
    source("components/Header.tsx"),
    source("components/footer.tsx"),
  ]);

  assert.match(home, /getDictionary\(locale\)/);
  assert.match(home, /copy\.reasons\.title/);
  assert.match(home, /copy\.listings\.title/);
  assert.match(home, /copy\.cta\.title/);
  assert.match(hero, /dictionary\.home\.hero/);
  assert.match(header, /dictionary\.navigation\.home/);
  assert.match(header, /dictionary\.footer\.license/);
  assert.match(footer, /dictionary\.footer\.brandDescription/);
});

test("property gallery controls are locale-aware without Spanish literals in the component", async () => {
  const gallery = await source("components/GaleriaPropiedad.tsx");

  assert.match(gallery, /usePublicLocale\(\)/);
  assert.match(gallery, /dictionary\.gallery\.open/);
  assert.match(gallery, /dictionary\.gallery\.view/);
  assert.match(gallery, /dictionary\.gallery\.viewImage/);
  assert.match(gallery, /dictionary\.gallery\.viewVideo/);
  assert.match(gallery, /dictionary\.gallery\.close/);
  assert.match(gallery, /dictionary\.gallery\.previous/);
  assert.match(gallery, /dictionary\.gallery\.next/);
  assert.doesNotMatch(gallery, /Abrir galer|Ver galer|Cerrar galer/);
});

test("Phase 2.5 pages consume shared dictionaries without duplicating page JSX", async () => {
  const [
    about,
    englishAbout,
    contact,
    englishContact,
    listings,
    englishListings,
    listingsClient,
    testimonialsClient,
    privacy,
    englishPrivacy,
  ] = await Promise.all([
    source("app/(public)/about/page.tsx"),
    source("app/(public)/en/about/page.tsx"),
    source("app/(public)/contact/page.tsx"),
    source("app/(public)/en/contact/page.tsx"),
    source("app/(public)/listados/page.tsx"),
    source("app/(public)/en/listings/page.tsx"),
    source("components/ListadosClient.tsx"),
    source("app/(public)/testimonios/TestimoniosClientPage.tsx"),
    source("app/(public)/privacidad/page.tsx"),
    source("app/(public)/en/privacy/page.tsx"),
  ]);

  assert.match(about, /getDictionary\(locale\)\.about/);
  assert.match(englishAbout, /renderAboutPage\(ENGLISH_LOCALE\)/);
  assert.match(contact, /getDictionary\(locale\)\.contactHub/);
  assert.match(englishContact, /renderContactPage\(ENGLISH_LOCALE\)/);
  assert.match(listings, /getDictionary\(locale\)\.listingsPage/);
  assert.match(englishListings, /locale: ENGLISH_LOCALE/);
  assert.match(listingsClient, /dictionary\.listingsPage/);
  assert.match(testimonialsClient, /dictionary\.testimonialsPage/);
  assert.match(privacy, /getDictionary\(locale\)\.privacyPage/);
  assert.match(englishPrivacy, /renderPrivacyPage\(ENGLISH_LOCALE\)/);

  assert.match(listingsClient, /\{propiedad\.titulo\}/);
  assert.match(listingsClient, /\{propiedad\.descripcion\}/);
  assert.match(testimonialsClient, /\{item\.texto\}/);
  assert.match(testimonialsClient, /\{displayTitle\}/);
  assert.doesNotMatch(englishAbout, /<main|<Header/);
  assert.doesNotMatch(englishContact, /<main|<Header/);
  assert.doesNotMatch(englishListings, /<main|<Header/);
  assert.doesNotMatch(englishPrivacy, /<main|<Header/);
});

test("Phase 2.5 does not introduce a dynamic English property route or localized SEO", async () => {
  const [sitemap, robots, englishTree] = await Promise.all([
    source("app/sitemap.ts"),
    source("app/robots.ts"),
    source("app/(public)/en/listings/page.tsx"),
  ]);

  assert.doesNotMatch(sitemap, /\/en(?:\/|`|")/);
  assert.doesNotMatch(robots, /\/en(?:\/|`|")/);
  assert.doesNotMatch(englishTree, /generateMetadata|alternates|jsonLd/);
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
