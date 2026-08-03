import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function source(path) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

test("main property detail remains indexable, self-canonical, and authoritative for property JSON-LD", async () => {
  const page = await source("app/(public)/listados/[slug]/page.tsx");
  const seo = await source("lib/i18n/seo.ts");

  assert.match(page, /buildPropertySeoMetadata/);
  assert.match(page, /generateLocalizedPropertyMetadata\(params, DEFAULT_LOCALE\)/);
  assert.match(seo, /spanishPath:\s*`\/listados\/\$\{input\.slug\}`/);
  assert.match(seo, /indexable:\s*input\.locale !== ENGLISH_LOCALE \|\| input\.englishCoverageComplete/);
  assert.doesNotMatch(page, /robots:\s*\{[\s\S]*?index:\s*false/);
  assert.match(page, /"@type":\s*"Offer"/);
  assert.match(page, /"@type":\s*"Residence"/);
});

test("property Buyer Profile is noindex, follow and canonicalizes to the property detail", async () => {
  const page = await source(
    "app/(public)/listados/[slug]/perfil-comprador/page.tsx"
  );

  assert.match(page, /robots:\s*\{[\s\S]*?index:\s*false,[\s\S]*?follow:\s*true/);
  assert.match(
    page,
    /canonical:\s*getEquivalentRoute\(`\/listados\/\$\{slug\}`, locale\) \?\? `\/listados\/\$\{slug\}`/
  );
  assert.doesNotMatch(page, /"@type":\s*"(?:Offer|Residence)"/);
});

test("Open House registration is noindex, follow and canonicalizes to the property detail", async () => {
  const page = await source(
    "app/(public)/listados/[slug]/registro-openhouse/page.tsx"
  );

  assert.match(page, /robots:\s*\{[\s\S]*?index:\s*false,[\s\S]*?follow:\s*true/);
  assert.match(
    page,
    /canonical:\s*getEquivalentRoute\(`\/listados\/\$\{slug\}`, locale\) \?\? `\/listados\/\$\{slug\}`/
  );
  assert.doesNotMatch(page, /"@type":\s*"(?:Offer|Residence)"/);
});

test("Priority Registration is noindex, follow and never canonicalizes to the properties prefix", async () => {
  const page = await source(
    "app/(public)/properties/[slug]/registro-prioritario/page.tsx"
  );

  assert.match(page, /robots:\s*\{[\s\S]*?index:\s*false,[\s\S]*?follow:\s*true/);
  assert.match(
    page,
    /const propertyPath = getEquivalentRoute\(`\/listados\/\$\{propiedad\.slug\}`, locale\) \?\? `\/listados\/\$\{propiedad\.slug\}`/
  );
  assert.match(page, /canonical:\s*propertyPath/);
  assert.doesNotMatch(page, /canonical:\s*path/);
  assert.doesNotMatch(page, /"@type":\s*"(?:Offer|Residence)"/);
});

test("Private Showing retains its stricter robots, referrer, cache, and analytics protections", async () => {
  const [page, config, analytics] = await Promise.all([
    source("app/(public)/listados/[slug]/visita/[privateToken]/page.tsx"),
    source("next.config.ts"),
    source("lib/analytics-routes.ts"),
  ]);

  assert.match(page, /index:\s*false/);
  assert.match(page, /follow:\s*false/);
  assert.match(page, /referrer:\s*"no-referrer"/);
  assert.doesNotMatch(page, /canonical/);
  assert.doesNotMatch(page, /privateToken[\s\S]*alternates/);
  assert.match(config, /X-Robots-Tag[\s\S]*noindex, nofollow, noarchive/);
  assert.match(config, /Cache-Control[\s\S]*private, no-store/);
  assert.match(analytics, /\\\/visita\\\//);
});

test("sitemap and robots preserve public crawling while excluding transactional forms", async () => {
  const [sitemap, robots] = await Promise.all([
    source("app/sitemap.ts"),
    source("app/robots.ts"),
  ]);

  assert.match(sitemap, /\/listados\/\$\{item\.slug\}/);
  assert.doesNotMatch(
    sitemap,
    /perfil-comprador|registro-openhouse|registro-prioritario|privateToken|\/visita\//
  );
  assert.match(robots, /allow:\s*"\/"/);
  assert.match(robots, /disallow:\s*\["\/admin\/", "\/api\/"\]/);
  assert.doesNotMatch(
    robots,
    /perfil-comprador|registro-openhouse|registro-prioritario|\/visita\//
  );
});

test("general informational contact routes keep their distinct self-canonical intent", async () => {
  for (const path of [
    "app/(public)/contact/compradores-arrendatarios/page.tsx",
    "app/(public)/contact/vendedor-arrendador/page.tsx",
    "app/(public)/contact/perfil-comprador/page.tsx",
  ]) {
    const page = await source(path);
    assert.match(page, /buildLocalizedMetadata\(\{ locale: DEFAULT_LOCALE, spanishPath: pagePath/);
    assert.doesNotMatch(page, /index:\s*false/);
  }
});
