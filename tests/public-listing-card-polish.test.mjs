import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(
  new URL("../components/ListadosClient.tsx", import.meta.url),
  "utf8"
);
const homepageSource = await readFile(
  new URL("../app/(public)/page.tsx", import.meta.url),
  "utf8"
);

test("public listing cards use the result count to keep one- and two-card states balanced", () => {
  assert.match(source, /propiedadesFiltradas\.length === 1/);
  assert.match(source, /md:grid-cols-\[minmax\(0,32rem\)\] md:justify-center/);
  assert.match(source, /propiedadesFiltradas\.length === 2/);
  assert.match(source, /md:grid-cols-2 xl:mx-auto xl:max-w-5xl/);
  assert.match(source, /md:grid-cols-2 xl:grid-cols-3/);
});

test("public listing cards keep strong imagery while reducing vertical dominance", () => {
  assert.match(source, /aspect-\[4\/3\][^\n]*sm:aspect-video/);
  assert.doesNotMatch(source, /relative h-72 w-full bg/);
  assert.match(source, /object-cover transition-transform/);
});

test("public listing cards use a concise property-first hierarchy", () => {
  assert.match(source, /line-clamp-2 text-lg font-bold leading-snug/);
  assert.doesNotMatch(source, /\{propiedad\.descripcion\}/);
  assert.match(source, /className="mt-auto"/);
  assert.match(source, /grid grid-cols-3 gap-2[^\n]*pt-3/);
  assert.match(source, /inline-flex min-h-11[^\n]*border border-\[#11518b\]\/25/);
  assert.match(source, /<ArrowRight aria-hidden="true"/);
});

test("listing detail remains a separate accessible link beside the favorite control", () => {
  assert.match(source, /<button[\s\S]*?onClick=\{\(\) => toggleFavorite\(propiedad\.id\)\}/);
  assert.match(source, /<Link[\s\S]*?getEquivalentRoute\(`\/listados\/\$\{propiedad\.slug\}`/);
  assert.doesNotMatch(source, /<article[^>]*onClick=/);
});

test("homepage listing cards remain a separate implementation", () => {
  assert.doesNotMatch(homepageSource, /ListadosClient/);
  assert.match(homepageSource, /dictionary\.common\.viewProperty/);
});
