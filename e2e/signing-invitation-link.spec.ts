import { expect, test } from "@playwright/test";

test.describe("private signing invitation handoff", () => {
  test.skip(process.env.E2E_SIGNING_INVITATION_LINK !== "1", "Requires the isolated signer runtime.");

  test("fragment bearer is scrubbed and the exact mobile/desktop form reaches the signer UI", async ({ page }) => {
    const syntheticToken = "T".repeat(43);
    let exchanged = false;
    await page.route("**/api/signatures/session/exchange", async (route) => {
      const request = route.request();
      expect(request.method()).toBe("POST");
      expect(new URLSearchParams(request.postData() ?? "").get("token")).toBe(syntheticToken);
      exchanged = true;
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<main><h1>Documento listo para completar</h1></main>",
      });
    });

    await page.goto(`/firmar/invitacion#${syntheticToken}`);
    await expect(page).toHaveURL(/\/firmar\/invitacion$/);
    await page.getByRole("button", { name: "Continuar de forma segura" }).click();
    await expect(page.getByRole("heading", { name: "Documento listo para completar" })).toBeVisible();
    expect(exchanged).toBe(true);
  });
});
