import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function source(path) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

test("global security headers use report-only CSP and block framing", async () => {
  const config = await source("next.config.ts");
  assert.match(config, /Content-Security-Policy-Report-Only/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.match(config, /object-src 'none'/);
  assert.match(config, /base-uri 'self'/);
  assert.match(config, /form-action 'self'/);
  assert.match(config, /X-Frame-Options/);
  assert.match(config, /DENY/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /\/admin\/:path\*/);
  assert.match(config, /private, no-store/);
});

test("every sensitive public form is masked from Clarity", async () => {
  for (const path of [
    "components/RegistroPrioritarioForm.tsx",
    "components/FormularioPerfilComprador.tsx",
    "components/FormularioComprador.tsx",
    "components/FormularioVendedor.tsx",
    "components/PerfilCompradorPropiedadForm.tsx",
  ]) {
    assert.match(await source(path), /data-clarity-mask="true"/, path);
  }
});

test("admin and private-token routes remain excluded from analytics", async () => {
  const routes = await source("lib/analytics-routes.ts");
  assert.match(routes, /parsedPath === "\/admin"/);
  assert.match(routes, /isPrivateTokenizedPath/);
  assert.match(routes, /visita/);
});

test("privacy page is public and linked from the public footer", async () => {
  const page = await source("app/(public)/privacidad/page.tsx");
  const footer = await source("components/footer.tsx");
  const spanishDictionary = await source("locales/es-PR.ts");
  assert.match(page, /getDictionary\(locale\)\.privacyPage/);
  assert.match(spanishDictionary, /Google Analytics/);
  assert.match(spanishDictionary, /Microsoft\s+Clarity/);
  assert.match(spanishDictionary, /documentos\s+financieros/);
  assert.match(footer, /localizedHref\("\/privacidad"\)/);
});
