import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = (file) => readFile(path.join(root, file), "utf8");

test("serverless runtime uses a small pooled-compatible connection cap per warm instance", async () => {
  const database = await source("lib/db.ts");
  assert.match(database, /max:\s*3/);
  assert.match(database, /prepare:\s*false/);
  assert.match(database, /idle_timeout:\s*10/);
});

test("public catalog reads are cached and invalidated by their Admin mutations", async () => {
  const [properties, testimonials, propertyActions, testimonialActions] = await Promise.all([
    source("lib/queries/propiedades.ts"),
    source("lib/queries/testimonios.ts"),
    source("app/admin/propiedades/actions.ts"),
    source("app/admin/testimonios/actions.ts"),
  ]);
  for (const query of [properties, testimonials]) {
    assert.match(query, /unstable_cache/);
    assert.match(query, /revalidate:\s*PUBLIC_CONTENT_REVALIDATE_SECONDS/);
  }
  assert.match(propertyActions, /revalidateTag\(PUBLIC_PROPERTIES_CACHE_TAG,\s*"max"\)/);
  assert.match(testimonialActions, /revalidateTag\(PUBLIC_TESTIMONIALS_CACHE_TAG,\s*"max"\)/);
});

test("public property cache projections keep heavy form configuration and full galleries out of catalog entries", async () => {
  const properties = await source("lib/queries/propiedades.ts");

  const indexQuery = properties.match(/const getCachedPropiedades = unstable_cache\(async \(\) => \{([\s\S]*?)\n\}, \["public-properties-all"\]/)?.[1] ?? "";
  const featuredQuery = properties.match(/const getCachedPropiedadesDestacadas = unstable_cache\(async \(limit: number\) => \{([\s\S]*?)\n\}, \["public-properties-featured"\]/)?.[1] ?? "";
  const paginatedQuery = properties.match(/const getCachedPropiedadesPaginadas = unstable_cache\(async \(([\s\S]*?)\n\}, \["public-properties-paginated"\]/)?.[1] ?? "";
  const detailQuery = properties.match(/const getCachedPropiedadBySlug = unstable_cache\(async \(slug: string\) => \{([\s\S]*?)\n\}, \["public-property-by-slug"\]/)?.[1] ?? "";
  const similarQuery = properties.match(/const getCachedPropiedadesSimilares = unstable_cache\(async \(([\s\S]*?)\n\}, \["public-properties-similar"\]/)?.[1] ?? "";

  assert.match(indexQuery, /p\.id,[\s\S]*p\.slug,[\s\S]*p\.destacado/);
  assert.doesNotMatch(indexQuery, /configuracion_formulario|propiedad_imagenes|json_agg/);
  for (const catalogQuery of [featuredQuery, paginatedQuery]) {
    assert.match(catalogQuery, /ARRAY\([\s\S]*LIMIT 1/);
    assert.doesNotMatch(catalogQuery, /configuracion_formulario|json_agg/);
  }
  assert.match(detailQuery, /configuracion_formulario->>'notas_compradores'/);
  assert.doesNotMatch(detailQuery, /p\.configuracion_formulario,/);
  assert.match(detailQuery, /p\.fecha_showing AT TIME ZONE 'America\/Puerto_Rico' AS fecha_showing/);
  assert.doesNotMatch(similarQuery, /p\.descripcion/);
});

test("public open-house rendering reuses its cached property showing time", async () => {
  const openHouse = await source("app/(public)/listados/[slug]/registro-openhouse/page.tsx");
  assert.doesNotMatch(openHouse, /getCanonicalOpenHouseShowingAt/);
  assert.match(openHouse, /formatoFechaOpenHouse\(\s*propiedad\.fecha_showing/);
});

test("production builds do not query Neon for the public home page or sitemap", async () => {
  const [home, sitemap] = await Promise.all([
    source("app/(public)/page.tsx"),
    source("app/sitemap.ts"),
  ]);

  for (const source of [home, sitemap]) {
    assert.match(source, /import \{ connection \} from "next\/server"/);
    assert.match(source, /await connection\(\)/);
  }
  assert.match(home, /Promise\.allSettled/);
});

test("Analytics live refresh remains opt-in and skips hidden tabs", async () => {
  const controls = await source("components/admin/analytics/AnalyticsRefreshControls.tsx");
  assert.match(controls, /useState<RefreshInterval>\("off"\)/);
  assert.match(controls, /document\.visibilityState === "visible"/);
});

test("security-sensitive signing and authentication reads are never placed in the public data cache", async () => {
  const [auth, signerAccess, signerSession] = await Promise.all([
    source("lib/admin/auth.ts"),
    source("lib/signatures/canary-gate.ts"),
    source("lib/signatures/signer/repository.ts"),
  ]);
  for (const sensitive of [auth, signerAccess, signerSession]) {
    assert.doesNotMatch(sensitive, /unstable_cache|use cache/);
  }
});
