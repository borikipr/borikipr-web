import { expect, test } from "@playwright/test";

test.describe("private signing invitation handoff", () => {
  test.skip(process.env.E2E_SIGNING_INVITATION_LINK !== "1", "Requires the isolated signer runtime.");

  test("fragment bearer is scrubbed and the exact mobile/desktop form reaches the signer UI", async ({ page }) => {
    const syntheticToken = "T".repeat(43);
    let exchanged = false;
    await page.route("**/firmar/sesion", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<main><h1>Documento listo para completar</h1></main>",
      });
    });
    await page.route("**/api/signatures/session/exchange", async (route) => {
      const request = route.request();
      expect(request.method()).toBe("POST");
      expect(request.headers().origin).toBe(new URL(page.url()).origin);
      expect(request.headers().accept).toContain("application/json");
      expect(request.postData()).toContain(syntheticToken);
      exchanged = true;
      await route.fulfill({ status: 204 });
    });

    const response = await page.goto(`/firmar/invitacion#${syntheticToken}`);
    const contentSecurityPolicy = response?.headers()["content-security-policy"] ?? "";
    expect(contentSecurityPolicy).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
    const scriptPolicy = contentSecurityPolicy
      .split(";")
      .find((directive) => directive.trim().startsWith("script-src"));
    expect(scriptPolicy).not.toContain("'unsafe-inline'");
    await expect(page).toHaveURL(/\/firmar\/invitacion$/);
    const continueButton = page.getByRole("button", { name: "Continuar de forma segura" });
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(page.getByRole("heading", { name: "Documento listo para completar" })).toBeVisible();
    expect(exchanged).toBe(true);
  });
});
