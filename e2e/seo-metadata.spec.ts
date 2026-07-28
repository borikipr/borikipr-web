import { expect, test } from "@playwright/test";

const propertySlug = process.env.E2E_SEO_PROPERTY_SLUG;

test.describe("transactional property route SEO", () => {
  test.skip(!propertySlug, "Set E2E_SEO_PROPERTY_SLUG for GET-only SEO checks.");

  test("property and ordinary transactional routes expose the intended indexing policy", async ({
    page,
  }) => {
    const propertyPath = `/listados/${propertySlug}`;
    const canonical = new URL(propertyPath, test.info().project.use.baseURL).href;

    await page.goto(propertyPath);
    await expect(page).toHaveURL(new RegExp(`${propertyPath}/?$`));
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      canonical
    );
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    for (const formPath of [
      `${propertyPath}/perfil-comprador`,
      `${propertyPath}/registro-openhouse`,
      `/properties/${propertySlug}/registro-prioritario`,
    ]) {
      const response = await page.goto(formPath);
      expect(response?.status()).toBe(200);
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex,\s*follow/i
      );
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        canonical
      );
    }
  });

  test("transactional forms remain absent from the sitemap", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBeTruthy();
    const sitemap = await response.text();

    expect(sitemap).toContain(`/listados/${propertySlug}`);
    expect(sitemap).not.toContain("perfil-comprador");
    expect(sitemap).not.toContain("registro-openhouse");
    expect(sitemap).not.toContain("registro-prioritario");
    expect(sitemap).not.toContain("/visita/");
  });

  test("production host canonical and trailing-slash behavior remain unchanged", async ({
    request,
  }) => {
    const baseURL = test.info().project.use.baseURL;
    const trailingResponse = await request.get(`/listados/${propertySlug}/`, {
      maxRedirects: 0,
    });

    expect(trailingResponse.status()).toBe(308);
    expect(trailingResponse.headers().location).toBe(
      `/listados/${propertySlug}`
    );

    if (!baseURL || new URL(baseURL).hostname !== "borikipr.com") {
      return;
    }

    const wwwResponse = await request.get("https://www.borikipr.com/");
    expect(wwwResponse.status()).toBe(200);
    expect(await wwwResponse.text()).toContain(
      '<link rel="canonical" href="https://borikipr.com"'
    );
  });
});
