import { expect, test } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";

const enabled = process.env.E2E_SIGNING_ADMIN_QA === "1";
const draftFixturePath = path.resolve("tmp/signatures/phase2n-admin-draft.pdf");

test.describe("signing governance responsive Admin", () => {
  test.skip(!enabled, "Requires the disposable isolated signing Admin runtime.");
  test.describe.configure({ mode: "serial", timeout: 300_000 });

  test.beforeAll(async () => {
    if (!enabled) return;
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([612, 792]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    page.drawText("SYNTHETIC PHASE 2N ADMIN DRAFT - TEST ONLY", { x: 54, y: 730, size: 14, font });
    await mkdir(path.dirname(draftFixturePath), { recursive: true });
    await writeFile(draftFixturePath, await pdf.save({ useObjectStreams: false }));
  });

  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium" && testInfo.title.includes("draft preparation"), "Operational mutation proof runs once on desktop.");
    await page.goto("/admin/login");
    await page.getByLabel("Usuario").fill(process.env.E2E_ADMIN_USERNAME || "synthetic-signing-admin");
    await page.getByLabel("Contraseña").fill(process.env.E2E_SIGNING_ADMIN_PASSWORD || "");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/admin", { timeout: 60_000 }),
      page.getByRole("button", { name: "Entrar" }).click(),
    ]);
    await page.goto("/admin/signatures/gobernanza", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /Gobernanza y preparación/ })).toBeVisible();
  });

  test("governance controls remain within 360, 390 and 412px viewports", async ({ page }) => {
    for (const width of [360, 390, 412]) {
      await page.setViewportSize({ width, height: 915 });
      const details = page.locator(".signature-governance details");
      for (let index = 0; index < await details.count(); index += 1) await details.nth(index).evaluate((element) => { (element as HTMLDetailsElement).open = true; });
      await expect(page.getByText("Aprobación interna de Erickson Real Estate").first()).toBeVisible();
      const overflow = await page.evaluate(() => {
        window.scrollTo({ left: document.documentElement.scrollWidth, top: 0 });
        const pageScroll = window.scrollX;
        window.scrollTo({ left: 0, top: 0 });
        return { pageScroll,
        offenders: [...document.querySelectorAll(".signature-governance input, .signature-governance select, .signature-governance textarea, .signature-governance button")]
          .filter((element) => { const box = element.getBoundingClientRect(); return box.left < -1 || box.right > innerWidth + 1; }).length,
        widest: [...document.querySelectorAll("body *")].map((element) => {
          const box = element.getBoundingClientRect();
          return { tag: element.tagName, className: String(element.className).slice(0, 100), left: box.left, right: box.right, width: box.width };
        }).filter((box) => box.left < -1 || box.right > innerWidth + 1).sort((a, b) => b.right - a.right).slice(0, 5),
      }; });
      expect(overflow.pageScroll, JSON.stringify(overflow.widest)).toBe(0);
      expect(overflow.offenders).toBe(0);
    }
  });

  test("desktop workflow remains three columns and exposes no runtime errors", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const classification = page.getByText("Clasificaciones de documentos", { exact: true }).last();
    await classification.click();
    await expect(page.getByRole("heading", { name: "1. Crear borrador" }).first()).toBeVisible();
    await expect(page.getByRole("heading", { name: "3. Registrar decisión" }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("draft preparation stays available while both signing gates are disabled", async ({ page }) => {
    await page.goto("/admin/signatures/nuevo", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");
    await page.waitForTimeout(1_000);
    await page.getByLabel(/T.tulo interno/).fill("TEST NON-PRODUCTION Phase 2N draft UX");
    await page.getByLabel(/Tipo de documento/).selectOption("ordinary_brokerage_agreement");
    await page.getByLabel(/Fecha de expiraci.n/).fill("2026-09-30");
    await page.getByLabel(/PDF fuente/).setInputFiles(draftFixturePath);
    const [createdResponse] = await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/api/admin/signatures/drafts") && response.request().method() === "POST", { timeout: 60_000 }),
      page.getByRole("button", { name: /Validar y crear borrador/ }).click(),
    ]);
    const created = await createdResponse.json() as { documentId: string };
    await page.goto(`/admin/signatures/${created.documentId}`, { waitUntil: "domcontentloaded" });

    const participants = page.getByRole("heading", { name: /Participantes/ }).locator("..");
    await participants.getByLabel("Nombre").fill("Participante Sintético");
    await participants.getByLabel("Correo").fill("phase2n-participant@example.test");
    await participants.getByLabel("Rol").fill("Comprador");
    await participants.getByLabel(/Orden/).fill("1");
    await participants.getByRole("button", { name: /Añadir participante/ }).click();
    await expect(page.getByRole("heading", { name: "Participantes (1/8)" })).toBeVisible({ timeout: 60_000 });

    await expect(page.getByRole("button", { name: "Envío bloqueado" })).toBeDisabled();

    await participants.getByLabel("Nombre").fill("Participante Duplicado");
    await participants.getByLabel("Correo").fill("phase2n-participant@example.test");
    await participants.getByLabel("Rol").fill("Vendedor");
    await participants.getByRole("button", { name: /Añadir participante/ }).click();
    await expect(page.getByText("Este correo ya pertenece a otro participante.")).toBeVisible({ timeout: 60_000 });

    const closeDraft = page.getByRole("heading", { name: "Cerrar borrador" }).locator("..");
    const deleteForm = closeDraft.locator("form").filter({ has: page.getByRole("button", { name: "Eliminar borrador inerte" }) });
    await deleteForm.getByLabel("Razón").fill("Confirmar protección de evidencia sintética");
    await deleteForm.getByLabel(/Escribe/).fill("ELIMINAR BORRADOR");
    await deleteForm.getByRole("button", { name: "Eliminar borrador inerte" }).click();
    await expect(page.getByText(/contiene actividad o evidencia/)).toBeVisible({ timeout: 60_000 });

    const archiveForm = closeDraft.locator("form").filter({ has: page.getByRole("button", { name: "Archivar y preservar evidencia" }) });
    await archiveForm.getByLabel(/Razón para archivar/).fill("Cierre de prueba sintética Phase 2N");
    await archiveForm.getByRole("button", { name: "Archivar y preservar evidencia" }).click();
    await expect(page.getByText(/Borrador archivado/)).toBeVisible({ timeout: 60_000 });
  });
});
