import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const source = (file) => readFile(path.join(process.cwd(), file), "utf8");

test("healthy signing infrastructure is quiet on daily Firmas surfaces", async () => {
  const [layout, templates, settings] = await Promise.all([
    source("app/admin/signatures/layout.tsx"),
    source("app/admin/signatures/plantillas/page.tsx"),
    source("app/admin/signatures/configuracion/page.tsx"),
  ]);

  assert.match(layout, /inspectProductionPublicLaunchGate/);
  assert.match(layout, /!publicLaunchAllowed/);
  assert.match(layout, /Firmas requiere atención/);
  assert.match(layout, /role="alert"/);
  assert.doesNotMatch(layout, /Canary interno:/);
  assert.doesNotMatch(layout, /Firma pública:/);
  assert.doesNotMatch(templates, /Firma pública|Canary interno|Readiness|recovery/i);
  assert.doesNotMatch(settings, /Canary interno|Firma pública|READY no equivale a ENABLED/);
});

test("legacy broker settings remain internal compatibility rather than daily signing UX", async () => {
  const [settings, brokerControl] = await Promise.all([
    source("app/admin/signatures/configuracion/page.tsx"),
    source("app/admin/signatures/configuracion/BrokerSettingsControl.tsx"),
  ]);

  assert.match(settings, /redirect\("\/admin\/signatures"\)/);
  assert.match(brokerControl, /Cambiar corredora final/);
  assert.match(brokerControl, /SignatureActionDialog/);
  assert.doesNotMatch(settings, /Corredora final/);
  assert.doesNotMatch(settings, /Cuenta Admin de Ivonne/);
  assert.doesNotMatch(settings, /Privacidad y conservación/);
});

test("broker signature UX resolves the configured broker without identity hardcoding", async () => {
  const [draftForm, templateList, templateUse, draftRoute, editor, preflight, directory, ux] = await Promise.all([
    source("app/admin/signatures/nuevo/NewSignatureDraftForm.tsx"),
    source("app/admin/signatures/plantillas/page.tsx"),
    source("app/admin/signatures/plantillas/[id]/usar/page.tsx"),
    source("app/api/admin/signatures/drafts/route.ts"),
    source("components/admin/signatures/SignatureDraftEditor.tsx"),
    source("lib/signatures/preflight.ts"),
    source("lib/signatures/draft-application.ts"),
    source("lib/signatures/admin-ux.ts"),
  ]);

  assert.match(draftForm, /requiresBrokerSignature/);
  assert.match(draftForm, /Firmará al final:/);
  assert.match(templateList, /Corredor\(a\) asignado al crear · Firma final/);
  assert.match(templateUse, /Firmará al final:/);
  assert.match(draftRoute, /No hay un corredor autorizado disponible/);
  assert.match(editor, /El corredor\(a\) asignado firma al final/);
  assert.match(preflight, /asignación de corredor\(a\) de este documento/);
  assert.match(directory, /resolveSignatureBrokerCandidate/);
  assert.match(directory, /routingOrder:8/);
  assert.match(ux, /isBrokerFinalSigner \? "la corredora"/);
});

test("Governance remains a direct support route and its security logic is unchanged", async () => {
  const [governance, settings, layout] = await Promise.all([
    source("app/admin/signatures/gobernanza/page.tsx"),
    source("app/admin/signatures/configuracion/page.tsx"),
    source("app/admin/signatures/layout.tsx"),
  ]);

  assert.match(governance, /Estado operativo/);
  assert.match(governance, /Neon recovery/);
  assert.match(governance, /R2 recovery/);
  assert.match(settings, /redirect\("\/admin\/signatures"\)/);
  assert.match(layout, /href="\/admin\/signatures\/gobernanza"/);
});
