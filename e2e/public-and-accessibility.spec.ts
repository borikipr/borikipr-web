import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

function seriousViolations(
  violations: Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]
) {
  return violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical"
  );
}

test("home exposes the explicit Sur region contract", async ({ page }) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveTitle(/Erickson Real Estate/i);
  const sur = page.getByRole("link", { name: /Sur/i }).first();
  await expect(sur).toHaveAttribute("href", /\/listados\?region=sur/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

test("public privacy page loads and passes serious accessibility checks", async ({
  page,
}) => {
  await page.goto("/privacidad");
  await expect(
    page.getByRole("heading", { name: /Cómo utilizamos tu información/i })
  ).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(seriousViolations(results.violations)).toEqual([]);
});

test("admin login is usable, private, and accessible", async ({ page }) => {
  const response = await page.goto("/admin/login");
  expect(response?.headers()["cache-control"]).toMatch(/no-store|no-cache/);
  await expect(page.getByRole("textbox", { name: /usuario/i })).toBeVisible();
  await expect(page.getByRole("button", { name: /Entrar/i })).toBeVisible();
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  expect(seriousViolations(results.violations)).toEqual([]);
});

test("mobile public and admin-auth pages have no horizontal overflow", async ({
  page,
}) => {
  for (const path of ["/privacidad", "/admin/login"]) {
    await page.goto(path, { waitUntil: "domcontentloaded" });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth
    );
    expect(overflow, path).toBe(false);
  }
});

test("browser security headers are present", async ({ request }) => {
  const response = await request.get("/privacidad");
  expect(response.headers()["x-frame-options"]).toBe("DENY");
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  expect(
    response.headers()["content-security-policy-report-only"]
  ).toContain("frame-ancestors 'none'");
});
