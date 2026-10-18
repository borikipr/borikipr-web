import { expect, test } from "@playwright/test";

const route = "/listados/hacienda-monte-carmelo-cascadas-cafe-guayanilla/registro-showing";

test("registration page renders the complete artwork and approved form", async ({ page }) => {
  await page.goto(route);

  await expect(page).toHaveTitle(/Registro Showing \| Hacienda Monte Carmelo/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "21 CUERDAS DE TERRENO | HACIENDA MONTE CARMELO"
  );
  await expect(page.getByText("Domingo, 25 de octubre de 2026")).toBeVisible();

  const artwork = page.getByAltText(/Arte oficial de Hacienda Monte Carmelo/);
  await expect(artwork).toBeVisible();
  const renderedArtwork = await artwork.evaluate((image: HTMLImageElement) => ({
    naturalWidth: image.naturalWidth,
    naturalHeight: image.naturalHeight,
    objectFit: getComputedStyle(image).objectFit,
  }));
  expect(renderedArtwork.objectFit).toBe("contain");
  expect(renderedArtwork.naturalWidth / renderedArtwork.naturalHeight).toBeCloseTo(940 / 788, 2);

  await expect(page.getByLabel("Nombre completo")).toBeVisible();
  await expect(page.locator("#phone")).toBeVisible();
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await expect(page.locator('fieldset:has(input[name="attendance"]) legend')).toContainText(
    "¿Asistirás al Showing este domingo, 25 de octubre, a las 10:00 a. m.?"
  );
  await expect(page.getByText(/coordinar la asistencia al Showing/)).toBeVisible();
  await expect(page.getByText(/open house/i)).toHaveCount(0);
  await expect(page.getByText("política de privacidad")).toHaveAttribute("href", "/privacidad");
  await expect(page.getByRole("button", { name: "Confirmar y enviar información" })).toBeVisible();
  await expect(page.locator('input[name="purchaseMethod"]')).toHaveCount(3);
  await expect(page.locator('input[name="purchaseMethod"][value="Estoy evaluando mis opciones."]')).toHaveCount(0);
  for (const option of await page.locator('input[type="radio"], input[type="checkbox"][name="interests"]').evaluateAll((inputs) =>
    inputs.map((input) => (input as HTMLInputElement).value)
  )) {
    expect(option.endsWith(".")).toBe(false);
  }
});

test("conditional questions show, require answers, and clear stale values", async ({ page }) => {
  await page.goto(route);

  await page.getByLabel("Mediante financiamiento").check();
  const financing = page.locator('fieldset:has(input[name="financingStatus"])');
  await expect(financing).toBeVisible();
  await expect(page.locator('input[name="financingStatus"]')).toHaveCount(3);
  await expect(page.getByLabel("No aplica", { exact: true })).toHaveCount(0);
  await page.getByLabel("Estoy en proceso con una institución financiera").check();
  await page.getByLabel("Compra en efectivo (cash)").check();
  await expect(financing).toHaveCount(0);

  await page.locator('input[name="worksWithRealtor"][value="Sí"]').check();
  const realtorName = page.getByLabel("Nombre completo del corredor o Realtor®");
  await realtorName.fill("Corredor Ejemplo");
  await page.getByLabel("Número de teléfono del corredor o Realtor®").fill("787-555-1111");
  await page.locator('input[name="worksWithRealtor"][value="No"]').check();
  await expect(realtorName).toHaveCount(0);
  await page.locator('input[name="worksWithRealtor"][value="Sí"]').check();
  await expect(page.getByLabel("Nombre completo del corredor o Realtor®")).toHaveValue("");

  await page.getByRole("checkbox", { name: "Otro interés", exact: true }).check();
  const other = page.getByLabel("Cuéntanos sobre ese otro interés (opcional)");
  await other.fill("Conservación");
  await page.getByRole("checkbox", { name: "Otro interés", exact: true }).uncheck();
  await expect(other).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Otro interés", exact: true }).check();
  await expect(page.getByLabel("Cuéntanos sobre ese otro interés (opcional)")).toHaveValue("");
});

test("form preserves values after recoverable delivery errors", async ({ page }) => {
  await page.route("**/api/hacienda-monte-carmelo-showing", async (route) => {
    await route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: "No pudimos enviar tu información en este momento." }),
    });
  });
  await page.goto(route);
  await page.getByLabel("Nombre completo").fill("María Rivera");
  await page.locator("#phone").fill("787-555-1234");
  await page.getByLabel("Correo electrónico").fill("maria@example.com");
  await page.getByLabel("Sí, asistiré").check();
  await page.getByLabel("Compra en efectivo (cash)").check();
  await page.locator('input[name="worksWithRealtor"][value="No"]').check();
  await page.getByLabel(/Confirmo que leí este aviso/).check();
  await page.getByRole("button", { name: "Confirmar y enviar información" }).click();

  await expect(page.getByRole("alert").filter({ hasText: "No pudimos enviar" })).toBeVisible();
  await expect(page.getByLabel("Nombre completo")).toHaveValue("María Rivera");
  await expect(page.getByRole("button", { name: "Confirmar y enviar información" })).toBeEnabled();
});

test("form shows only the approved success language after acceptance", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/hacienda-monte-carmelo-showing", async (route) => {
    requests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(route);
  await page.getByLabel("Nombre completo").fill("María Rivera");
  await page.locator("#phone").fill("787-555-1234");
  await page.getByLabel("Correo electrónico").fill("maria@example.com");
  await page.getByLabel("Todavía no estoy seguro/a").check();
  await page.getByLabel("Dependerá de la negociación y las condiciones de compra").check();
  await page.locator('input[name="worksWithRealtor"][value="No"]').check();
  await page.getByLabel(/Confirmo que leí este aviso/).check();
  const button = page.getByRole("button", { name: "Confirmar y enviar información" });
  await button.dblclick();

  await expect(page.getByText("Gracias por completar el formulario.")).toBeVisible();
  await expect(page.getByText("Hemos recibido tu información relacionada con Hacienda Monte Carmelo.")).toBeVisible();
  expect(requests).toBe(1);
});

test("page has no horizontal overflow at required mobile, tablet, and desktop widths", async ({ page }) => {
  for (const width of [360, 390, 412, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(route);
    expect(await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      viewport: window.innerWidth,
    }))).toEqual({ overflow: 0, viewport: width });
    await expect(page.getByRole("button", { name: "Confirmar y enviar información" })).toBeVisible();
  }
});
