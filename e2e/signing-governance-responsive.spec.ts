import { expect, test, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";

const enabled = process.env.E2E_SIGNING_ADMIN_QA === "1";
const fixturePath = path.resolve("tmp/signatures/phase2p-admin-draft.pdf");

async function login(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Usuario").fill(process.env.E2E_ADMIN_USERNAME || "synthetic-signing-admin");
  await page.getByLabel(/Contrase/).fill(process.env.E2E_SIGNING_ADMIN_PASSWORD || "");
  await Promise.all([
    page.waitForURL((url) => url.pathname === "/admin", { timeout: 60_000 }),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
}

async function createDraft(page: Page, title: string) {
  await page.goto("/admin/signatures/nuevo", { waitUntil: "domcontentloaded" });
  await page.getByLabel(/T.tulo interno/).fill(title);
  await page.getByLabel(/Tipo de documento/).selectOption("transaction_acknowledgment");
  await page.getByLabel(/Fecha de expiraci.n/).fill("2026-09-30");
  await page.getByLabel(/PDF fuente/).setInputFiles(fixturePath);
  const [response] = await Promise.all([
    page.waitForResponse((item) => item.url().endsWith("/api/admin/signatures/drafts") && item.request().method() === "POST", { timeout: 120_000 }),
    page.getByRole("button", { name: "Guardar y continuar" }).click(),
  ]);
  expect(response.status()).toBe(201);
  const created = await response.json() as { documentId: string };
  await page.waitForURL((url) => url.pathname === `/admin/signatures/${created.documentId}`, { timeout: 60_000 });
  return created.documentId;
}

async function addRecipient(page: Page, input: { name: string; email: string; role: string; order: string }) {
  const form = page.locator("form").filter({ has: page.getByRole("button", { name: "Añadir destinatario" }) });
  await form.getByLabel("Nombre").fill(input.name);
  await form.getByLabel("Correo").fill(input.email);
  await form.getByLabel("Rol").fill(input.role);
  await form.getByLabel(/Orden de visualizaci.n/).fill(input.order);
  await form.getByRole("button", { name: "Añadir destinatario" }).click();
  await expect(page.getByText(input.email, { exact: true })).toBeVisible({ timeout: 60_000 });
}

test.describe("Phase 2P operational signing UX", () => {
  test.skip(!enabled, "Requires the disposable isolated signing Admin runtime.");
  test.describe.configure({ mode: "serial", timeout: 600_000 });

  test.beforeAll(async () => {
    if (!enabled) return;
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let index = 0; index < 2; index += 1) {
      const page = pdf.addPage([612, 792]);
      page.drawText(`SYNTHETIC PHASE 2P ADMIN UX - PAGE ${index + 1}`, { x: 54, y: 730, size: 14, font });
    }
    await mkdir(path.dirname(fixturePath), { recursive: true });
    await writeFile(fixturePath, await pdf.save({ useObjectStreams: false }));
  });

  test.beforeEach(async ({ page }) => login(page));

  test("desktop user can prepare recipients and fields, then understand the governance blocker", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Desktop journey runs once in desktop Chromium.");
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/admin/signatures");
    await expect(page.getByRole("heading", { name: "Solicitudes de firma" })).toBeVisible();
    await page.getByRole("link", { name: "Nuevo documento" }).first().click();
    const documentId = await createDraft(page, "TEST Phase 2P normal preparation");

    await addRecipient(page, { name: "Destinatario Uno", email: "phase2p-one@example.test", role: "Comprador", order: "1" });
    await addRecipient(page, { name: "Destinatario Dos", email: "phase2p-two@example.test", role: "Vendedor", order: "2" });
    await expect(page.getByText("2/8", { exact: true })).toBeVisible();

    const second = page.locator("article").filter({ hasText: "phase2p-two@example.test" });
    await second.getByRole("button", { name: "Editar" }).click();
    await second.getByLabel("Rol").fill("Agente listador");
    await second.getByRole("button", { name: "Guardar" }).click();
    await expect(second.getByText("Agente listador", { exact: false })).toBeVisible({ timeout: 60_000 });
    await second.getByRole("button", { name: "Eliminar destinatario" }).click();
    await expect(page.getByText("1/8", { exact: true })).toBeVisible({ timeout: 60_000 });

    await page.getByRole("button", { name: "Campos", exact: true }).click();
    await expect(page.getByRole("heading", { name: "3. Coloca los campos" })).toBeVisible();
    await page.getByRole("button", { name: "+ Firma" }).click();
    const field = page.getByRole("button", { name: /Mover campo Firma/ });
    await expect(field).toBeVisible({ timeout: 60_000 });
    await field.focus();
    await field.press("ArrowRight");
    await page.getByRole("combobox", { name: "Página", exact: true }).selectOption("1");
    await expect(page.getByLabel("Página 2 del PDF")).toBeVisible();
    await page.getByRole("button", { name: "Revisar", exact: true }).click();
    await expect(page.getByText("Falta configuración para enviar este documento.")).toBeVisible();
    await expect(page.getByText(/Readiness SHA-256/)).toBeHidden();
    const governance = page.getByRole("link", { name: "Ir a Gobernanza" });
    await expect(governance).toBeVisible();
    await governance.click();
    await expect(page).toHaveURL(/\/admin\/signatures\/gobernanza/);
    await page.goBack();
    await expect(page).toHaveURL(new RegExp(`/admin/signatures/${documentId}`));
    // The signing-only fixture intentionally omits the unrelated propiedades catalog;
    // production Admin route health is verified separately after deployment.
    expect(errors.filter((message) => !message.includes('relation "propiedades" does not exist'))).toEqual([]);
  });

  test("smart remove cleans an inert draft and archives a draft with evidence", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "Lifecycle mutation journey runs once in desktop Chromium.");
    const runId = Date.now().toString(36);
    const inertTitle = `TEST Phase 2P inert cleanup ${runId}`;
    await createDraft(page, inertTitle);
    const remove = page.getByText("Eliminar solicitud", { exact: true }).locator("..");
    await page.getByText("Eliminar solicitud", { exact: true }).click();
    await remove.getByLabel("Razón").fill("Limpieza sintética autorizada");
    await remove.getByLabel(/Escribe/).fill("ELIMINAR BORRADOR");
    await remove.getByRole("button", { name: "Eliminar este borrador" }).click();
    await expect(page.getByRole("heading", { name: "Fuera de solicitudes activas" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole("link", { name: "Abrir PDF" })).toHaveCount(0);
    await page.goto("/admin/signatures?view=active");
    await expect(page.getByText(inertTitle, { exact: true })).toHaveCount(0);
    await page.goto("/admin/signatures?view=archived");
    await expect(page.getByText(inertTitle, { exact: true })).toBeVisible();

    const evidenceTitle = `TEST Phase 2P evidence archive ${runId}`;
    await createDraft(page, evidenceTitle);
    await addRecipient(page, { name: "Evidencia Sintética", email: "phase2p-evidence@example.test", role: "Arrendatario", order: "1" });
    const evidenceRemove = page.getByText("Eliminar solicitud", { exact: true }).locator("..");
    await page.getByText("Eliminar solicitud", { exact: true }).click();
    await evidenceRemove.getByLabel("Razón").fill("Retirar prueba sintética del flujo activo");
    await evidenceRemove.getByRole("button", { name: "Quitar de solicitudes activas" }).click();
    await expect(page.getByRole("heading", { name: "Fuera de solicitudes activas" })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(/evidencia que deba mantenerse/)).toBeVisible();
    await page.goto("/admin/signatures?view=active");
    await expect(page.getByText(evidenceTitle, { exact: true })).toHaveCount(0);
    await page.goto("/admin/signatures?view=archived");
    await expect(page.getByText(evidenceTitle, { exact: true })).toBeVisible();
  });

  test("mobile drawer, directory cards and preparation steps fit 360, 390 and 412px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chromium", "Mobile journey runs in the touch-capable project.");
    for (const width of [360, 390, 412]) {
      await page.setViewportSize({ width, height: 915 });
      await page.goto("/admin/signatures");
      const menu = page.getByRole("button", { name: "Abrir menú de administración" });
      await menu.click();
      const drawer = page.getByRole("dialog", { name: "Menú de administración" });
      await expect(drawer).toBeVisible();
      await expect(drawer.getByRole("link", { name: "Firmas" })).toHaveAttribute("aria-current", "page");
      await page.keyboard.press("Escape");
      await expect(drawer).toBeHidden();
      await menu.click();
      await expect(drawer.getByRole("link", { name: "Dashboard" })).toBeVisible();
      await drawer.getByRole("link", { name: "Mi perfil" }).click();
      await expect(page).toHaveURL(/\/admin\/profile$/);
      await page.getByRole("button", { name: "Abrir menú de administración" }).click();
      await page.getByRole("dialog").getByRole("link", { name: "Firmas" }).click();
      await expect(page).toHaveURL(/\/admin\/signatures$/);
      const overflow = await page.evaluate(() => ({
        page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        controls: [...document.querySelectorAll("button,input,select,textarea,a")].filter((element) => {
          const box = element.getBoundingClientRect();
          return box.left < -1 || box.right > innerWidth + 1;
        }).map((element) => ({ tag: element.tagName, text: element.textContent?.trim().slice(0, 60), box: element.getBoundingClientRect().toJSON() })),
      }));
      expect(overflow.page).toBe(0);
      expect(overflow.controls).toEqual([]);
    }
  });
});
