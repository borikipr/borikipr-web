import { expect, test } from "@playwright/test";

test.describe("private signing invitation handoff", () => {
  test.skip(process.env.E2E_SIGNING_INVITATION_LINK !== "1", "Requires the isolated signer runtime.");

  test("email navigation exchanges the bearer, accepts consent, and reaches the document UI", async ({ page }) => {
    const syntheticToken = "T".repeat(43);
    let exchanged = false;
    let consented = false;
    await page.route("**/firmar/sesion", async (route) => {
      if (!consented) {
        await route.fulfill({
          status: 200,
          contentType: "text/html",
          body: `<!doctype html><html><body><main>
            <h1>Consentimiento electrónico</h1>
            <form id="consent" action="/api/signatures/session/consent" method="post">
              <input type="hidden" name="csrf" value="synthetic-csrf" />
              <button>Acepto expresamente y deseo continuar</button>
            </form>
            <script>
              document.querySelector('#consent').addEventListener('submit', async (event) => {
                event.preventDefault();
                const response = await fetch(event.currentTarget.action, {
                  method: 'POST',
                  body: new FormData(event.currentTarget),
                  credentials: 'same-origin',
                  headers: { Accept: 'application/json' },
                });
                if (response.status === 204) window.location.assign('/firmar/sesion');
              });
            </script>
          </main></body></html>`,
        });
        return;
      }
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
    await page.route("**/api/signatures/session/consent", async (route) => {
      const request = route.request();
      expect(request.method()).toBe("POST");
      expect(request.headers().origin).toBe(new URL(page.url()).origin);
      expect(request.headers().accept).toContain("application/json");
      expect(request.postData()).toContain("synthetic-csrf");
      consented = true;
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
    await expect(page.getByRole("heading", { name: /Consentimiento/ })).toBeVisible();
    await page.getByRole("button", { name: "Acepto expresamente y deseo continuar" }).click();
    await expect(page.getByRole("heading", { name: "Documento listo para completar" })).toBeVisible();
    expect(exchanged).toBe(true);
    expect(consented).toBe(true);
  });
});
