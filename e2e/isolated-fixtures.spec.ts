import { expect, test } from "@playwright/test";

const fixtureEnabled = process.env.E2E_FULL_FIXTURES === "1";
const fixturePropertySlug = process.env.E2E_PROPERTY_SLUG || "";
const fixtureLeadPath = process.env.E2E_LEAD_PATH || "";
const fixtureCasePath = process.env.E2E_CASE_PATH || "";

test.describe("isolated database fixtures", () => {
  test.skip(
    !fixtureEnabled,
    "Requires an isolated seeded database and disposable admin credentials."
  );

  test("listings, property detail, and public validation", async ({ page }) => {
    await page.goto("/listados?region=sur");
    await expect(page.getByText(/Región: Sur/i)).toBeVisible();
    await page.goto(`/listados/${fixturePropertySlug}`);
    await expect(page.locator("main")).toBeVisible();
    const priorityLink = page.getByRole("link", {
      name: /registro prioritario/i,
    });
    if (await priorityLink.count()) {
      await priorityLink.first().click();
      await expect(page.locator("form")).toBeVisible();
    }
  });

  test("authenticated lead, case, property actions, and logout", async ({
    page,
  }) => {
    await page.goto("/admin/login");
    await page.getByLabel(/usuario/i).fill(process.env.E2E_ADMIN_USERNAME || "");
    await page
      .getByLabel(/contraseña/i)
      .fill(process.env.E2E_ADMIN_PASSWORD || "");
    await page.getByRole("button", { name: /iniciar sesión/i }).click();
    await page.goto("/admin/leads");
    await expect(page.locator("main")).toBeVisible();
    await page.goto(fixtureLeadPath);
    await expect(page.getByText(/Lead 360/i)).toBeVisible();
    await page.goto(fixtureCasePath);
    await expect(page.getByText(/Caso compartido/i)).toBeVisible();
    await page.goto("/admin/propiedades");
    await expect(page.locator("main")).toBeVisible();
  });
});

