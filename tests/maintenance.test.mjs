import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function source(path) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

test("sitemap uses truthful property timestamps and no request-time dates", async () => {
  const sitemap = await source("app/sitemap.ts");
  const queries = await source("lib/queries/propiedades.ts");
  assert.doesNotMatch(sitemap, /lastModified:\s*new Date\(\)/);
  assert.match(sitemap, /item\.content_updated_at/);
  assert.match(queries, /AS content_updated_at/);
});

test("public and admin copyright years are dynamic", async () => {
  const publicFooter = await source("components/footer.tsx");
  const adminFooter = await source("components/admin/AdminFooter.tsx");
  assert.match(publicFooter, /new Date\(\)\.getFullYear\(\)/);
  assert.match(adminFooter, /new Date\(\)\.getFullYear\(\)/);
  assert.doesNotMatch(publicFooter, /©\s+20\d\d/);
});

test("removed contact API has no source consumers", async () => {
  for (const path of [
    "components/FormularioComprador.tsx",
    "components/FormularioVendedor.tsx",
    "components/FormularioPerfilComprador.tsx",
    "components/PerfilCompradorPropiedadForm.tsx",
  ]) {
    assert.doesNotMatch(await source(path), /\/api\/contact/);
  }
});

