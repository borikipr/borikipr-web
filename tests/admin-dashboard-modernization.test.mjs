import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(fileURLToPath(new URL(path, root)), "utf8");

test("Dashboard keeps authenticated data reads bounded and hydration-stable", async () => {
  const page = await source("app/admin/page.tsx");
  assert.match(page, /getAdminSession\(\)/);
  assert.match(page, /Promise\.all\(\[/);
  assert.match(page, /getAdminDashboardStats\(\)/);
  assert.match(page, /getTranslationUsageStatus/);
  assert.doesNotMatch(page, /Date\.now\(|Math\.random\(|window\.|localStorage/);
  assert.doesNotMatch(page, /["']use client["']/);
});

test("Dashboard exposes business metrics and primary Admin tools", async () => {
  const page = await source("app/admin/page.tsx");
  for (const label of ["Total", "Disponibles", "Bajo contrato", "Cerradas", "Destacadas"]) assert.match(page, new RegExp(`label: "${label}"`));
  for (const href of ["/admin/propiedades", "/admin/signatures", "/admin/leads", "/admin/testimonios", "/admin/analytics"]) assert.ok(page.includes(`href: "${href}"`));
  assert.match(page, /aria-labelledby="dashboard-inventory-title"/);
  assert.match(page, /aria-labelledby="dashboard-tools-title"/);
});

test("Translation usage is compact by default without losing operational detail", async () => {
  const panel = await source("components/admin/TranslationUsageStatus.tsx");
  assert.doesNotMatch(panel, /<details|<summary|Ver detalle operativo/);
  assert.match(panel, /Caracteres este mes \(UTC\)/);
  assert.match(panel, /Intentos este mes \(UTC\)/);
  assert.match(panel, /label="Caracteres"/);
  assert.match(panel, /label="Intentos"/);
  assert.match(panel, /label="En cola"/);
  assert.match(panel, /label="Procesando"/);
  assert.match(panel, /label="Fallidos"/);
  assert.match(panel, /label="Pausados por límite"/);
  assert.match(panel, /Worker:/);
  assert.match(panel, /Proveedor:/);
  assert.match(panel, /<progress aria-label=/);
  assert.match(panel, /Traducciones automáticas pausadas por límite de uso\./);
});

test("Dashboard has intentional compact mobile layouts", async () => {
  const css = await source("app/globals.css");
  assert.match(css, /\.dashboard-metric-grid[\s\S]*grid-cols-2/);
  assert.match(css, /\.dashboard-workspace-grid/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*\.dashboard-metric-tile/);
  assert.match(css, /\.dashboard-tool-link[\s\S]*min-h-\[4\.75rem\]/);
});
