import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const source = (file) => readFile(path.join(process.cwd(), file), "utf8");

test("Firmas keeps operational actions while condensing duplicate governance detail", async () => {
  const [directory, detail, actions, actionMenu, settings, governance, forms] = await Promise.all([
    source("app/admin/signatures/page.tsx"),
    source("app/admin/signatures/[id]/page.tsx"),
    source("components/admin/signatures/SignatureDocumentActions.tsx"),
    source("components/admin/signatures/SignatureActionsMenu.tsx"),
    source("app/admin/signatures/configuracion/page.tsx"),
    source("app/admin/signatures/gobernanza/page.tsx"),
    source("app/admin/signatures/gobernanza/GovernanceForms.tsx"),
  ]);

  assert.match(directory, /signature-lifecycle-mobile-menu/);
  assert.match(directory, /Descargar documento firmado/);
  assert.match(directory, /Descargar certificado/);
  assert.match(detail, /signature-activity-panel/);
  assert.match(detail, /Detalles avanzados/);
  assert.match(actionMenu, /aria-haspopup="menu"/);
  assert.match(actions, /Eliminar definitivamente/);
  assert.match(actionMenu, /onKeyDown/);
  assert.match(settings, /Abrir Gobernanza/);
  assert.doesNotMatch(settings, /id="avanzado"/);
  assert.match(governance, /Sin bloqueadores adicionales para este alcance/);
  assert.match(governance, /Estado operativo/);
  assert.match(governance, /Firma pública/);
  assert.match(governance, /Neon recovery/);
  assert.match(governance, /R2 recovery/);
  assert.match(governance, /Auditoría y referencia/);
  assert.doesNotMatch(governance, /row&&<details/);
  assert.doesNotMatch(governance, /<summary>Detalles avanzados<\/summary>/);
  assert.doesNotMatch(forms, /Autorización futura de canary interno/);
  assert.match(forms, /Autorización — LANZAMIENTO PÚBLICO/);
  assert.match(forms, /Decisiones de recuperación/);
  assert.match(forms, /Versiones y políticas/);
  assert.match(forms, /Acciones sensibles/);
  assert.equal((forms.match(/<details/g) ?? []).length, 2);
  assert.doesNotMatch(forms, /<summary className="font-semibold">Clasificaciones de documentos/);
});
