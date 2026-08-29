import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const source = (file) => readFile(path.join(process.cwd(), file), "utf8");

test("Firmas keeps operational actions while condensing duplicate governance detail", async () => {
  const [directory, detail, actions, actionMenu, settings, governance] = await Promise.all([
    source("app/admin/signatures/page.tsx"),
    source("app/admin/signatures/[id]/page.tsx"),
    source("components/admin/signatures/SignatureDocumentActions.tsx"),
    source("components/admin/signatures/SignatureActionsMenu.tsx"),
    source("app/admin/signatures/configuracion/page.tsx"),
    source("app/admin/signatures/gobernanza/page.tsx"),
  ]);

  assert.match(directory, /signature-lifecycle-mobile-menu/);
  assert.match(directory, /Descargar documento firmado/);
  assert.match(directory, /Descargar certificado/);
  assert.match(detail, /signature-activity-panel/);
  assert.match(detail, /Detalles avanzados/);
  assert.match(actionMenu, /aria-haspopup="menu"/);
  assert.match(actions, /Eliminar definitivamente/);
  assert.match(actionMenu, /onKeyDown/);
  assert.match(settings, /redirect\("\/admin\/signatures"\)/);
  assert.doesNotMatch(settings, /id="avanzado"/);
  assert.match(governance, /Estado y soporte/);
  assert.match(governance, /Firmas operando normalmente/);
  assert.match(governance, /Neon/);
  assert.match(governance, /R2/);
  assert.match(governance, /Firma pública/);
  assert.match(governance, /Recuperación/);
  assert.doesNotMatch(governance, /Canary interno|Auditoría y referencia|Readiness interno/);
  assert.doesNotMatch(governance, /row&&<details/);
  assert.doesNotMatch(governance, /<summary>Detalles avanzados<\/summary>/);
  assert.doesNotMatch(governance, /Administrar controles|Autorización futura de canary interno|Versiones y políticas|Acciones sensibles/);
});
