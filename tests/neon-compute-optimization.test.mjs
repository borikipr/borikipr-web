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
