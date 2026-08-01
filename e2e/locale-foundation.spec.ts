import { expect, test } from "@playwright/test";

const multilingualEnabled =
  process.env.MULTILINGUAL_ENABLED?.trim().toLowerCase() === "true";

test.describe.configure({ timeout: 90_000 });

test("disabled multilingual mode preserves the Spanish production shell", async ({
  page,
}) => {
  test.skip(multilingualEnabled, "This assertion covers the disabled mode.");

  const response = await page.goto("/about");
  expect(await response?.text()).toContain('<html lang="es"');
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("[data-language-selector]")).toHaveCount(0);

  await expect(
    page.getByRole("heading", {
      name: "Experiencia, estrategia y acompañamiento en cada decisión.",
    })
  ).toBeVisible();

  const englishResponse = await page.goto("/en");
  expect(englishResponse?.status()).toBe(404);
  await expect(page.locator("[data-language-selector]")).toHaveCount(0);
});

test("enabled preview switches static routes and updates the document language", async ({
  page,
  viewport,
}) => {
  test.skip(!multilingualEnabled, "English preview is intentionally disabled.");

  const hydrationWarnings: string[] = [];
  page.on("console", (message) => {
    if (/hydration|did not match/i.test(message.text())) {
      hydrationWarnings.push(message.text());
    }
  });

  const response = await page.goto("/en/about");
  expect(await response?.text()).toContain('<html lang="en-US"');
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(
    page.getByRole("heading", {
      name: "Experience, strategy, and support in every decision.",
    })
  ).toBeVisible();

  if ((viewport?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }

  const selector = page.locator("[data-language-selector]:visible");
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("link", { name: "Español (ES)" })).toHaveAttribute(
    "href",
    "/about"
  );

  await page.goto("/en/contact?q=Ponce&page=2");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(
    page
      .locator("[data-language-selector]")
      .first()
      .locator('a[aria-label="Español (ES)"]')
  ).toHaveAttribute("href", "/contact?q=Ponce&page=2");
  expect(hydrationWarnings).toEqual([]);
});

test("enabled direct loads and client navigation never leave a stale document locale", async ({
  page,
  viewport,
}) => {
  test.skip(!multilingualEnabled, "English preview is intentionally disabled.");

  const englishHome = await page.goto("/en");
  expect(await englishHome?.text()).toContain('<html lang="en-US"');
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

  const spanishAbout = await page.goto("/about");
  expect(await spanishAbout?.text()).toContain('<html lang="es-PR"');
  await expect(page.locator("html")).toHaveAttribute("lang", "es-PR");

  if ((viewport?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: /Abrir men/ }).click();
  }

  const spanishSelector = (viewport?.width ?? 1280) < 1024
    ? page.locator('[data-mobile-menu][aria-hidden="false"] [data-language-selector]')
    : page.locator("[data-language-selector]:visible");
  await spanishSelector
    .getByRole("link", { name: "English (EN)" })
    .click();
  await expect(page).toHaveURL(/\/en\/about$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");

  if ((viewport?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }

  const englishSelector = (viewport?.width ?? 1280) < 1024
    ? page.locator('[data-mobile-menu][aria-hidden="false"] [data-language-selector]')
    : page.locator("[data-language-selector]:visible");
  await englishSelector
    .getByRole("link", { name: /Espa.*ol \(ES\)/ })
    .click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es-PR");
});

test("enabled mobile drawer keeps the selector reachable and closes safely after locale navigation", async ({
  page,
  viewport,
}) => {
  test.skip(!multilingualEnabled, "English preview is intentionally disabled.");
  test.skip((viewport?.width ?? 1280) >= 1024, "This assertion covers the mobile drawer.");

  const hydrationWarnings: string[] = [];
  page.on("console", (message) => {
    if (/hydration|did not match/i.test(message.text())) hydrationWarnings.push(message.text());
  });

  await page.goto("/about?q=Ponce&page=2");
  const openButton = page.getByRole("button", { name: /Abrir men/ });
  await openButton.click();

  const drawer = page.locator('[data-mobile-menu][aria-hidden="false"]');
  const scrollRegion = drawer.locator("[data-mobile-menu-scroll]");
  const selector = drawer.locator("[data-language-selector]");
  await expect(drawer).toBeVisible();
  await expect(page.getByRole("button", { name: /Cerrar men/ })).toBeFocused();
  expect(await scrollRegion.evaluate((element) => getComputedStyle(element).overflowY)).toMatch(
    /auto|scroll/
  );

  await selector.scrollIntoViewIfNeeded();
  const bounds = await selector.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.y).toBeGreaterThanOrEqual(0);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport!.height);

  await selector.getByRole("link", { name: "English (EN)" }).click();
  await expect(page).toHaveURL(/\/en\/about\?q=Ponce&page=2$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator('[data-mobile-menu][aria-hidden="true"]')).toHaveCount(1);

  await page.getByRole("button", { name: "Open menu" }).click();
  await page
    .locator('[data-mobile-menu][aria-hidden="false"]')
    .getByRole("link", { name: /Espa.*ol \(ES\)/ })
    .click();
  await expect(page).toHaveURL(/\/about\?q=Ponce&page=2$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "es-PR");

  await page.getByRole("button", { name: /Abrir men/ }).click();
  await page.keyboard.press("Escape");
  await expect(openButton).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  expect(hydrationWarnings).toEqual([]);
});

test("enabled preview renders all Phase 2.5 static page interfaces in English", async ({
  page,
}) => {
  test.skip(!multilingualEnabled, "English preview is intentionally disabled.");

  const routes = [
    {
      path: "/en/about",
      heading: "Experience, strategy, and support in every decision.",
    },
    { path: "/en/contact", heading: "How can I guide you?" },
    { path: "/en/privacy", heading: "How we use your information" },
  ];

  for (const route of routes) {
    await page.goto(route.path);
    await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true })
    ).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `${route.path} should not overflow horizontally`).toBeLessThanOrEqual(1);
  }
});

test("enabled preview renders query-backed Listings and Testimonials with isolated data", async ({
  page,
}) => {
  test.skip(!multilingualEnabled, "English preview is intentionally disabled.");
  test.skip(
    !process.env.E2E_DATABASE_URL,
    "Query-backed preview pages require the isolated E2E database."
  );

  for (const route of [
    { path: "/en/listings", heading: "Properties for sale and rent" },
    {
      path: "/en/testimonials",
      heading: "Real experiences. Results built on trust.",
    },
  ]) {
    await page.goto(route.path);
    await expect(
      page.getByRole("heading", { name: route.heading, exact: true })
    ).toBeVisible();
  }
});

test("locale selector preserves safe listings query parameters on desktop and mobile", async ({
  page,
  viewport,
}) => {
  test.skip(!multilingualEnabled, "English preview is intentionally disabled.");
  test.skip(
    !process.env.E2E_DATABASE_URL,
    "Listings preview requires the isolated E2E database."
  );

  await page.goto("/listados?region=sur&q=Ponce&page=2");

  if ((viewport?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Abrir menú" }).click();
  }

  const visibleSelector = page.locator("[data-language-selector]:visible");
  await expect(
    visibleSelector.getByRole("link", { name: "English (EN)" })
  ).toHaveAttribute("href", "/en/listings?region=sur&q=Ponce&page=2");
});
