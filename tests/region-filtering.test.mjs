import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getMunicipiosForRegion,
  getRegionByName,
  getRegionLabel,
  isRegionSlug,
} from "../data/zonas.ts";

test("the public region taxonomy is typed, exact, and preserves the existing six regions", () => {
  assert.equal(isRegionSlug("sur"), true);
  assert.equal(isRegionSlug("metropolitana"), true);
  assert.equal(isRegionSlug("suroeste"), false);
  assert.equal(isRegionSlug("../sur"), false);
  assert.equal(getRegionByName(" Sur "), "sur");
  assert.equal(getRegionLabel("sur"), "Sur");

  const sur = getMunicipiosForRegion("sur");
  assert.equal(sur.includes("Ponce"), true);
  assert.equal(sur.includes("San Juan"), false);
  assert.equal(sur.includes("Cabo Rojo"), false);

  assert.equal(getMunicipiosForRegion("metropolitana").includes("San Juan"), true);
  assert.equal(getMunicipiosForRegion("norte").includes("Arecibo"), true);
  assert.equal(getMunicipiosForRegion("este").includes("Fajardo"), true);
  assert.equal(getMunicipiosForRegion("oeste").includes("Cabo Rojo"), true);
  assert.equal(getMunicipiosForRegion("central").includes("Aibonito"), true);
});

test("home region cards use the explicit region contract instead of free-text search", async () => {
  const source = await readFile(new URL("../app/(public)/page.tsx", import.meta.url), "utf8");
  assert.match(source, /href=\{`\/listados\?region=/);
  assert.doesNotMatch(source, /href=\{`\/listados\?q=\$\{encodeURIComponent\(zona\.nombre\)\}/);
});

test("listing parsing, query filtering, UI chips, and pagination preserve region", async () => {
  const [pageSource, querySource, clientSource] = await Promise.all([
    readFile(new URL("../app/(public)/listados/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/queries/propiedades.ts", import.meta.url), "utf8"),
    readFile(new URL("../components/ListadosClient.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /isRegionSlug\(params\.region\)/);
  assert.match(pageSource, /region: region \|\| undefined/);
  assert.match(querySource, /p\.municipio IN \$\{sql\(regionMunicipios\)\}/);
  assert.match(clientSource, /params\.set\("region", filters\.region\)/);
  assert.match(clientSource, /Región: \{getRegionLabel\(region\)\}/);
  assert.match(clientSource, /new URLSearchParams\(queryString\)/);
});
