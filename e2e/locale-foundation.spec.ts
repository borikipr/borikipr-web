import { expect, test } from "@playwright/test";

const multilingualEnabled =
  process.env.MULTILINGUAL_ENABLED?.trim().toLowerCase() === "true";

test("disabled multilingual mode preserves the Spanish production shell", async ({
  page,
}) => {
  test.skip(multilingualEnabled, "This assertion covers the disabled mode.");

  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  await expect(page.locator("[data-language-selector]")).toHaveCount(0);

  const englishResponse = await page.goto("/en");
  expect(englishResponse?.status()).toBe(404);
  await expect(page.locator("[data-language-selector]")).toHaveCount(0);
});

test("enabled preview switches static routes and updates the document language", async ({
  page,
  viewport,
}) => {
  test.skip(!multilingualEnabled, "English preview is intentionally disabled.");

  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(
    page.getByRole("heading", {
      name: "Properties presented with strategy, intention, and presence.",
    })
  ).toBeVisible();

  if ((viewport?.width ?? 1280) < 1024) {
    await page.getByRole("button", { name: "Open menu" }).click();
  }

  const selector = page.locator("[data-language-selector]:visible");
  await expect(selector).toBeVisible();
  await expect(selector.getByRole("link", { name: "Español (ES)" })).toHaveAttribute(
    "href",
    "/"
  );

  await page.goto("/en/listings?region=sur&page=2");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(
    page
      .locator("[data-language-selector]")
      .first()
      .locator('a[aria-label="Español (ES)"]')
  ).toHaveAttribute("href", "/listados?region=sur&page=2");
});
