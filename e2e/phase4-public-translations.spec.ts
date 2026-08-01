import { expect, test } from "@playwright/test";

const multilingualEnabled =
  process.env.MULTILINGUAL_ENABLED?.trim().toLowerCase() === "true";
const fixtureSlug = process.env.E2E_PHASE4_PROPERTY_SLUG;

test.describe.configure({ timeout: 90_000 });

test("dynamic English property details are inaccessible while multilingual is disabled", async ({
  page,
}) => {
  test.skip(multilingualEnabled, "This assertion covers the disabled mode.");
  const response = await page.goto("/en/listings/phase4-fixture");
  expect(response?.status()).toBe(404);
});

test("isolated bilingual property detail renders responsively and switches to the same Spanish slug", async ({
  page,
}) => {
  test.skip(!multilingualEnabled, "English preview is intentionally disabled.");
  test.skip(
    !process.env.E2E_DATABASE_URL || !fixtureSlug,
    "Requires an isolated migrated and seeded Phase 4 PostgreSQL fixture plus E2E_PHASE4_PROPERTY_SLUG."
  );

  const response = await page.goto(`/en/listings/${fixtureSlug}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("main")).not.toContainText(/source_hash|job_id|provider_error/i);

  const description = page.locator("section").filter({ hasText: "Description" });
  await expect(description).toBeVisible();
  await expect(description.locator("p")).toHaveCSS("white-space", "pre-line");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const selector = page.locator("[data-language-selector]:visible");
  await expect(selector.getByRole("link", { name: /Espa.*ol \(ES\)/ })).toHaveAttribute(
    "href",
    `/listados/${fixtureSlug}`
  );
});
