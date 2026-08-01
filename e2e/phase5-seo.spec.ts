import { expect, test } from "@playwright/test";

const multilingualEnabled =
  process.env.MULTILINGUAL_ENABLED?.trim().toLowerCase() === "true";
const completePropertySlug = process.env.E2E_PHASE5_COMPLETE_PROPERTY_SLUG;
const incompletePropertySlug = process.env.E2E_PHASE5_INCOMPLETE_PROPERTY_SLUG;
const stalePropertySlug = process.env.E2E_PHASE5_STALE_PROPERTY_SLUG;
const untranslatedPropertySlug = process.env.E2E_PHASE5_UNTRANSLATED_PROPERTY_SLUG;
const spanishControlSlug = process.env.E2E_PHASE5_SPANISH_CONTROL_SLUG;
const fixtureDatabaseUrl = process.env.E2E_DATABASE_URL;
const queryAuditEnabled = process.env.E2E_PHASE5_QUERY_AUDIT === "true";
const partialSpanishDescription = "Descripci\u00f3n espa\u00f1ola de respaldo para la propiedad parcial.";
const staleSpanishDescription = "Descripci\u00f3n espa\u00f1ola vigente para la propiedad desactualizada.";
const untranslatedSpanishTitle = "Casa Sin Traducci\u00f3n de Prueba";
const untranslatedSpanishDescription = "Descripci\u00f3n espa\u00f1ola para la propiedad sin traducciones.";

function sitemapLocations(xml: string) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
}

async function parsedJsonLd(page: import("@playwright/test").Page) {
  return page.locator('script[type="application/ld+json"]').evaluateAll((scripts) =>
    scripts.map((script) => JSON.parse(script.textContent || "null"))
  );
}

type JsonLdEntry = Record<string, unknown> & {
  name?: string;
  itemOffered?: { description?: string };
  itemListElement?: Array<{ name: string }>;
};

function flattenedJsonLd(entries: unknown[]) {
  return entries.flatMap((entry) => Array.isArray(entry) ? entry : [entry]) as JsonLdEntry[];
}

async function translationTableScans() {
  if (!fixtureDatabaseUrl) throw new Error("E2E_DATABASE_URL is required for query isolation checks.");
  const { default: postgres } = await import("postgres");
  const database = postgres(fixtureDatabaseUrl, { ssl: false, max: 1 });
  try {
    await database.unsafe("SELECT pg_stat_force_next_flush()");
    const [row] = await database.unsafe<Array<{ seq_scan: number; idx_scan: number }>>(
      "SELECT seq_scan, idx_scan FROM pg_stat_user_tables WHERE schemaname = 'public' AND relname = 'content_translations'"
    );
    return Number(row?.seq_scan ?? 0) + Number(row?.idx_scan ?? 0);
  } finally {
    await database.end();
  }
}

test("disabled mode renders Spanish SEO without English discovery signals", async ({
  page,
  request,
}) => {
  test.skip(multilingualEnabled, "This assertion covers disabled multilingual mode.");

  const response = await page.goto("/about");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://borikipr.com/about"
  );
  await expect(page.locator('link[rel="alternate"][hreflang="en-US"]')).toHaveCount(0);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    "es_PR"
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveCount(1);

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  const locations = sitemapLocations(await sitemapResponse.text());
  expect(locations.some((url) => new URL(url).pathname.startsWith("/en"))).toBe(false);
});

test("disabled isolated dynamic property remains Spanish-only and translation-query free", async ({ page, request }, testInfo) => {
  test.skip(multilingualEnabled || !queryAuditEnabled || testInfo.project.name !== "desktop-chromium" || !fixtureDatabaseUrl || !spanishControlSlug,
    "Runs in the explicitly enabled disabled-mode fixture audit.");

  const response = await page.goto(`/listados/${spanishControlSlug}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("h1")).toContainText("Casa Control en Espa\u00f1ol");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://borikipr.com/listados/${spanishControlSlug}`);
  await expect(page.locator('link[rel="alternate"][hreflang="en-US"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /index, follow/);

  await page.waitForTimeout(1_200);
  const before = await translationTableScans();
  await page.reload();
  const sitemapResponse = await request.get("/sitemap.xml?disabled-fixture-audit=1");
  expect(sitemapResponse.status()).toBe(200);
  await page.waitForTimeout(1_200);
  expect((await translationTableScans()) - before).toBe(0);
  expect(sitemapLocations(await sitemapResponse.text()).some((url) => new URL(url).pathname.startsWith("/en"))).toBe(false);

  const englishResponse = await page.goto(`/en/listings/${spanishControlSlug}`);
  expect(englishResponse?.status()).toBe(404);
});

test("enabled static pages render self-canonicals, alternates, social locale, and valid JSON-LD", async ({
  page,
}) => {
  test.skip(!multilingualEnabled, "English SEO is intentionally feature-gated.");

  const response = await page.goto("/en/about");
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://borikipr.com/en/about"
  );
  await expect(page.locator('link[rel="alternate"][hreflang="es-PR"]')).toHaveAttribute(
    "href",
    "https://borikipr.com/about"
  );
  await expect(page.locator('link[rel="alternate"][hreflang="en-US"]')).toHaveAttribute(
    "href",
    "https://borikipr.com/en/about"
  );
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute(
    "href",
    "https://borikipr.com/about"
  );
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute(
    "content",
    "en_US"
  );
  await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute(
    "content",
    "es_PR"
  );
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute(
    "content",
    "https://borikipr.com/en/about"
  );
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute(
    "content",
    /About Ivonne Erickson/
  );

  const jsonLd = await parsedJsonLd(page);
  const business = jsonLd.find((entry) => entry?.["@type"] === "RealEstateAgent");
  const breadcrumbs = jsonLd.find((entry) => entry?.["@type"] === "BreadcrumbList");
  expect(business?.["@id"]).toBe("https://borikipr.com/#real-estate-agent");
  expect(business?.founder?.jobTitle).toBe("Real Estate Broker");
  expect(breadcrumbs?.itemListElement.at(-1)).toMatchObject({
    name: "About Ivonne Erickson",
    item: "https://borikipr.com/en/about",
  });
});

test("enabled sitemap exposes the approved English static routes", async ({
  request,
}) => {
  test.skip(!multilingualEnabled, "English SEO is intentionally feature-gated.");

  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const locations = sitemapLocations(await response.text());
  const english = locations
    .map((url) => new URL(url).pathname)
    .filter((pathname) => pathname === "/en" || pathname.startsWith("/en/"));
  const approvedStatic = [
    "/en",
    "/en/listings",
    "/en/contact",
    "/en/about",
    "/en/testimonials",
    "/en/privacy",
  ];
  for (const pathname of approvedStatic) expect(english).toContain(pathname);
  if (!fixtureDatabaseUrl) expect(english.sort()).toEqual(approvedStatic.sort());
});

test("isolated complete and incomplete English properties render the approved indexability policy", async ({
  page,
  request,
  browserName,
}) => {
  test.skip(!multilingualEnabled, "English SEO is intentionally feature-gated.");
  test.skip(
    !fixtureDatabaseUrl || !completePropertySlug || !incompletePropertySlug || !stalePropertySlug || !untranslatedPropertySlug,
    "Requires an isolated migrated Phase 5 PostgreSQL fixture and all dynamic property slugs."
  );

  const completeResponse = await page.goto(`/en/listings/${completePropertySlug}`);
  expect(completeResponse?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator("h1")).toContainText("Complete Test Fixture House");
  await expect(page.getByText("Manually authored English fixture description for validation.", { exact: true })).toBeVisible();
  await expect(page).toHaveTitle(/Complete Test Fixture House/);
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", /Manually authored English fixture description/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /index, follow/
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `https://borikipr.com/en/listings/${completePropertySlug}`
  );
  await expect(page.locator('link[rel="alternate"][hreflang="es-PR"]')).toHaveAttribute("href", `https://borikipr.com/listados/${completePropertySlug}`);
  await expect(page.locator('link[rel="alternate"][hreflang="en-US"]')).toHaveAttribute("href", `https://borikipr.com/en/listings/${completePropertySlug}`);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute("href", `https://borikipr.com/listados/${completePropertySlug}`);
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", /Complete Test Fixture House/);
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute("content", /Manually authored English fixture description/);
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", `https://borikipr.com/en/listings/${completePropertySlug}`);
  await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "en_US");
  await expect(page.locator('meta[property="og:locale:alternate"]')).toHaveAttribute("content", "es_PR");
  await expect(page.locator('meta[name="twitter:title"]')).toHaveAttribute("content", /Complete Test Fixture House/);
  await expect(page.locator('meta[name="twitter:description"]')).toHaveAttribute("content", /Manually authored English fixture description/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", "https://borikipr.com/og-image.jpg");

  const completeJsonLd = flattenedJsonLd(await parsedJsonLd(page));
  const completeOffer = completeJsonLd.find((entry) => entry?.["@type"] === "Offer");
  const completeBreadcrumbs = completeJsonLd.find((entry) => entry?.["@type"] === "BreadcrumbList");
  expect(completeOffer).toMatchObject({
    name: "Complete Test Fixture House",
    url: `https://borikipr.com/en/listings/${completePropertySlug}`,
    price: 250000,
    priceCurrency: "USD",
    itemOffered: {
      name: "Complete Test Fixture House",
      description: "Manually authored English fixture description for validation.",
      address: { addressLocality: "Ponce", addressRegion: "PR" },
    },
    seller: { "@id": "https://borikipr.com/#real-estate-agent" },
  });
  expect(completeBreadcrumbs?.itemListElement?.map((item: { name: string }) => item.name)).toEqual([
    "Home", "Listings", "Complete Test Fixture House",
  ]);

  await page.goto(`/en/listings/${incompletePropertySlug}`);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex, follow/
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `https://borikipr.com/en/listings/${incompletePropertySlug}`
  );
  await expect(page.locator("h1")).toContainText("Partial Test Fixture House");
  await expect(page.getByText(partialSpanishDescription, { exact: true })).toBeVisible();
  await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", partialSpanishDescription);
  const partialOffer = flattenedJsonLd(await parsedJsonLd(page)).find((entry) => entry?.["@type"] === "Offer");
  expect(partialOffer?.name).toBe("Partial Test Fixture House");
  expect(partialOffer?.itemOffered?.description).toBe(partialSpanishDescription);
  await expect(page.locator("body")).not.toContainText(/source_hash|translation_jobs|review_status/);

  for (const fixture of [
    {
      slug: stalePropertySlug,
      title: "Casa Desactualizada de Prueba",
      description: staleSpanishDescription,
      forbidden: "Stale English Title Must Never Appear",
    },
    {
      slug: untranslatedPropertySlug,
      title: untranslatedSpanishTitle,
      description: untranslatedSpanishDescription,
      forbidden: "source_hash",
    },
  ]) {
    const response = await page.goto(`/en/listings/${fixture.slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex, follow/);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", `https://borikipr.com/en/listings/${fixture.slug}`);
    await expect(page.locator("h1")).toContainText(fixture.title);
    await expect(page.getByText(fixture.description, { exact: true })).toBeVisible();
    await expect(page.locator("html")).not.toContainText(fixture.forbidden);
    const offer = flattenedJsonLd(await parsedJsonLd(page)).find((entry) => entry?.["@type"] === "Offer");
    expect(offer?.name).toBe(fixture.title);
    expect(offer?.itemOffered?.description).toBe(fixture.description);
    expect(JSON.stringify(offer)).not.toMatch(/source_hash|translated_source_hash|translation_jobs|review_status|provider_model|lock_version/);
  }

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  const locations = sitemapLocations(await sitemapResponse.text());
  expect(locations).toContain(`https://borikipr.com/en/listings/${completePropertySlug}`);
  for (const slug of [incompletePropertySlug, stalePropertySlug, untranslatedPropertySlug]) {
    expect(locations).not.toContain(`https://borikipr.com/en/listings/${slug}`);
    expect(locations).toContain(`https://borikipr.com/listados/${slug}`);
  }
  expect(new Set(locations).size).toBe(locations.length);

  if (browserName === "chromium") {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
});

test("isolated property and sitemap translation reads stay bounded", async ({ page, request }, testInfo) => {
  test.skip(!queryAuditEnabled || testInfo.project.name !== "desktop-chromium" || !multilingualEnabled || !fixtureDatabaseUrl || !completePropertySlug || !spanishControlSlug,
    "Runs alone in the explicitly enabled isolated query-audit pass.");

  await page.goto(`/listados/${spanishControlSlug}`);
  await page.waitForTimeout(1_200);
  const spanishBefore = await translationTableScans();
  await page.reload();
  await page.waitForTimeout(1_200);
  expect((await translationTableScans()) - spanishBefore).toBe(0);

  await page.goto(`/en/listings/${completePropertySlug}`);
  await page.waitForTimeout(1_200);
  const detailBefore = await translationTableScans();
  await page.reload();
  await page.waitForTimeout(1_200);
  const detailScans = (await translationTableScans()) - detailBefore;
  expect(detailScans).toBeGreaterThanOrEqual(1);
  expect(detailScans).toBeLessThanOrEqual(2);

  const sitemapResponse = await request.get("/sitemap.xml?fixture-audit=1");
  expect(sitemapResponse.status()).toBe(200);
});

test("mobile dynamic property locale switching preserves the slug", async ({ page }, testInfo) => {
  test.skip(
    testInfo.project.name !== "mobile-chromium" || !multilingualEnabled || !completePropertySlug,
    "This fixture assertion covers the enabled mobile property workflow."
  );

  await page.goto(`/en/listings/${completePropertySlug}`);
  await page.getByRole("button", { name: /menu/i }).click();
  const spanishLink = page.locator('[data-language-selector]').getByRole("link", {
    name: /Espa\u00f1ol \(ES\)/,
  });
  await spanishLink.scrollIntoViewIfNeeded();
  await expect(spanishLink).toBeVisible();
  await spanishLink.click();
  await expect(page).toHaveURL(new RegExp(`/listados/${completePropertySlug}$`));
  await expect(page.locator("html")).toHaveAttribute("lang", "es-PR");

  await page.getByRole("button", { name: /men\u00fa|menu/i }).click();
  const englishLink = page.locator('[data-language-selector]').getByRole("link", {
    name: /English \(EN\)/,
  });
  await englishLink.scrollIntoViewIfNeeded();
  await englishLink.click();
  await expect(page).toHaveURL(new RegExp(`/en/listings/${completePropertySlug}$`));
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator("[data-mobile-menu]")).toHaveAttribute("aria-hidden", "true");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
