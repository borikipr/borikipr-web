import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const source = (file) => readFile(path.join(process.cwd(), file), "utf8");

test("Estado y soporte presents recovery directly without engineering telemetry", async () => {
  const page = await source("app/admin/signatures/gobernanza/page.tsx");

  assert.match(page, /<h2 id="recuperacion"[^>]*>Recuperación<\/h2>/);
  assert.match(page, /Neon/);
  assert.match(page, /R2/);
  assert.match(page, /La recuperación se usa ante incidentes de infraestructura; no es una papelera/);
  assert.match(page, /recoveryBlockers/);
  assert.match(page, /role="alert"/);
  assert.doesNotMatch(page, /gobernanza\/gestion|Administrar controles|Canary interno|<details|<summary/);
  assert.doesNotMatch(page, /getSignatureOperationalSnapshot|getSignatureRetentionPreview|token counts|session counts/i);
});

test("the former governance management console is removed from normal product routing", async () => {
  const [management, settings, actions] = await Promise.all([
    source("app/admin/signatures/gobernanza/gestion/page.tsx"),
    source("app/admin/signatures/configuracion/page.tsx"),
    source("app/admin/signatures/gobernanza/actions.ts"),
  ]);

  assert.match(management, /getAdminSession/);
  assert.match(management, /redirect\("\/admin\/signatures\/gobernanza"\)/);
  assert.doesNotMatch(management, /GovernanceForms|createConsent|approveConsent|<details|<summary/);
  assert.match(settings, /redirect\("\/admin\/signatures"\)/);
  assert.match(actions, /getAdminSession|context\(/);
});
