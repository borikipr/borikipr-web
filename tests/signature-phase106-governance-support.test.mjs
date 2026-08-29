import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const source = (file) => readFile(path.join(process.cwd(), file), "utf8");

test("Estado y soporte keeps healthy governance quiet and direct", async () => {
  const page = await source("app/admin/signatures/gobernanza/page.tsx");

  assert.match(page, /title="Estado y soporte"/);
  assert.match(page, /Firmas operando normalmente/);
  assert.match(page, /Firmas requiere atención/);
  assert.match(page, /Firma pública/);
  assert.match(page, /Español e inglés listos/);
  assert.match(page, /Recuperación/);
  assert.match(page, /Neon/);
  assert.match(page, /R2/);
  assert.match(page, /role="alert"/);
  assert.doesNotMatch(page, /Canary interno|Readiness interno|Matriz de preparación|Monitoreo agregado|Auditoría y referencia/);
  assert.doesNotMatch(page, /getSignatureOperationalSnapshot|getSignatureRetentionPreview|GovernanceForms|<details|<summary/);
});

test("the former management route is authenticated and returns to concise support", async () => {
  const [page, management] = await Promise.all([
    source("app/admin/signatures/gobernanza/page.tsx"),
    source("app/admin/signatures/gobernanza/gestion/page.tsx"),
  ]);

  assert.doesNotMatch(page, /gobernanza\/gestion|Administrar controles/);
  assert.match(management, /getAdminSession/);
  assert.match(management, /redirect\("\/admin\/signatures\/gobernanza"\)/);
  assert.doesNotMatch(management, /GovernanceForms|Cambios extraordinarios/);
  assert.doesNotMatch(management, /<details|<summary/);
});
