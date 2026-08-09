import { expect, test } from "@playwright/test";

test("public signing surface remains unavailable while the server gate is disabled", async ({ page }) => {
  const response = await page.goto(`/firmar/${"A".repeat(43)}`);
  expect(response?.status()).toBe(404);
  await expect(page).not.toHaveURL(/\/firmar\/sesion/);
});
