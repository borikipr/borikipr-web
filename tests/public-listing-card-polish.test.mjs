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
const cardsSource = source.slice(
  source.indexOf("{propiedadesFiltradas.map"),
  source.indexOf("{/* Paginación */}")
);

test("public listing cards use the result count to keep one- and two-card states balanced", () => {
  assert.match(source, /propiedadesFiltradas\.length === 1/);
  assert.match(source, /md:grid-cols-\[minmax\(0,28rem\)\] md:justify-center/);
  assert.match(source, /propiedadesFiltradas\.length === 2/);
  assert.match(source, /md:grid-cols-2 xl:mx-auto xl:max-w-\[56rem\]/);
  assert.match(source, /md:grid-cols-2 xl:grid-cols-3/);
});

test("public listing cards keep strong imagery while reducing vertical dominance", () => {
  assert.match(source, /aspect-\[3\/2\][^\n]*sm:aspect-\[37\/20\]/);
  assert.doesNotMatch(source, /relative h-72 w-full bg/);
  assert.match(source, /object-cover transition-transform/);
});

test("public listing cards use compact controls and internal spacing", () => {
  assert.match(source, /left-3 top-3 flex flex-wrap gap-1\.5/);
  assert.match(source, /right-3 top-3 z-20 grid h-10 w-10 place-items-center/);
  assert.match(source, /flex flex-1 flex-col p-4 sm:px-5/);
});

test("public listing cards use a concise property-first hierarchy", () => {
  assert.match(source, /line-clamp-2 text-lg font-bold leading-snug/);
  assert.doesNotMatch(source, /\{propiedad\.descripcion\}/);
  assert.match(source, /className="mt-auto"/);
  assert.match(source, /grid grid-cols-3 gap-2[^\n]*pt-2\.5/);
  assert.doesNotMatch(source, /dictionary\.common\.viewProperty/);
  assert.doesNotMatch(source, /ArrowRight/);
});

test("the card link covers the non-favorite area without nested interactive controls", () => {
  assert.match(source, /<article[\s\S]*?className="group relative/);
  assert.match(source, /<button[\s\S]*?onClick=\{\(\) => toggleFavorite\(propiedad\.id\)\}[\s\S]*?z-20/);
  assert.match(source, /<h3[\s\S]*?<Link[\s\S]*?getEquivalentRoute\(`\/listados\/\$\{propiedad\.slug\}`/);
  assert.match(source, /after:absolute after:inset-0 after:z-10 after:rounded-3xl/);
  assert.doesNotMatch(cardsSource, /<Link[^>]*>[\s\S]*?<button/);
  assert.doesNotMatch(source, /<article[^>]*onClick=/);
});

test("card and favorite expose independent keyboard focus treatments", () => {
  assert.match(source, /focus-visible:after:ring-2 focus-visible:after:ring-inset/);
  assert.match(source, /focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-\[#11518b\]/);
});

test("homepage listing cards remain a separate implementation", () => {
  assert.doesNotMatch(homepageSource, /ListadosClient/);
  assert.match(homepageSource, /dictionary\.common\.viewProperty/);
});

test("listing filters expose localized accessible names without relying on placeholders", () => {
  assert.match(source, /aria-label=\{copy\.searchByLocation\}/);
  assert.match(source, /<label htmlFor="listados-precio-min"/);
  assert.match(source, /id="listados-precio-min"/);
  assert.match(source, /<label htmlFor="listados-precio-max"/);
  assert.match(source, /id="listados-precio-max"/);
  assert.match(source, /aria-label=\{copy\.bedrooms\}/);
  assert.match(source, /aria-label=\{copy\.bathrooms\}/);
});

test("location search moves to a useful second row on narrow screens", () => {
  assert.match(source, /grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_auto\][^\n]*sm:grid-cols-\[auto_auto_minmax\(0,1fr\)_auto\]/);
  assert.match(source, /relative col-span-2 mt-2 min-w-0 sm:col-span-1 sm:mt-0/);
  assert.match(source, /rounded-l border[^\n]*sm:rounded-none sm:border-l-0/);
  assert.match(source, /mt-2 flex min-h-11[^\n]*sm:mt-0/);
});
