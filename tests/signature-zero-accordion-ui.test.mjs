import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const source = (file) => readFile(path.join(process.cwd(), file), "utf8");

test("Firmas Admin presents scoped operational content without accordions or details", async () => {
  const files = [
    "app/admin/signatures/page.tsx",
    "app/admin/signatures/[id]/page.tsx",
    "app/admin/signatures/configuracion/page.tsx",
    "app/admin/signatures/gobernanza/page.tsx",
    "app/admin/signatures/gobernanza/gestion/page.tsx",
    "components/admin/signatures/SignatureDraftEditor.tsx",
  ];
  const contents = await Promise.all(files.map(source));

  for (const content of contents) {
    assert.doesNotMatch(content, /<details|<summary/);
  }
});

test("final broker changes use an explicit accessible dialog rather than a disclosure", async () => {
  const control = await source("app/admin/signatures/configuracion/BrokerSettingsControl.tsx");

  assert.match(control, /SignatureActionDialog/);
  assert.match(control, /Los documentos nuevos que requieran firma de corredora usarán esta cuenta como firmante final/);
  assert.match(control, /confirmationPhrase/);
  assert.doesNotMatch(control, /<details|<summary/);
});
