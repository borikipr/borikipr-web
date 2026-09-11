import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const gallery = await readFile(
  new URL("../components/GaleriaPropiedad.tsx", import.meta.url),
  "utf8"
);
const detail = await readFile(
  new URL("../app/(public)/listados/[slug]/page.tsx", import.meta.url),
  "utf8"
);

test("property detail shares the canonical localized property URL through Facebook", () => {
  assert.match(detail, /const propiedadUrl = `https:\/\/borikipr\.com\$\{propiedadPath\}`/);
  assert.match(detail, /facebook\.com\/sharer\/sharer\.php\?u=\$\{encodeURIComponent\(propiedadUrl\)\}/);
  assert.match(detail, /target="_blank"/);
  assert.match(detail, /rel="noopener noreferrer"/);
  assert.match(detail, /shareFacebookAccessible\.replace\("\{property\}", propiedad\.titulo\)/);
  assert.doesNotMatch(detail, /facebook\.com\/sdk|connect\.facebook\.net/);
});

test("main gallery exposes direct previous and next navigation with current position", () => {
  assert.match(gallery, /onClick=\{irAnterior\}/);
  assert.match(gallery, /onClick=\{irSiguiente\}/);
  assert.match(gallery, /\{indiceVisible \+ 1\} \/ \{totalImagenes\}/);
  assert.match(gallery, /aria-live="polite"/);
});

test("gallery thumbnails form a bounded horizontal filmstrip", () => {
  assert.match(gallery, /flex max-w-full snap-x gap-3 overflow-x-auto/);
  assert.match(gallery, /h-20 w-28 shrink-0 snap-start/);
  assert.match(gallery, /miniaturasRef\.current\[indiceVisible\]\?\.scrollIntoView/);
  assert.doesNotMatch(gallery, /mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3/);
  assert.match(gallery, /aria-current=\{activa \? "true" : undefined\}/);
});

test("lightbox is a labelled keyboard-contained dialog", () => {
  assert.match(gallery, /role="dialog"/);
  assert.match(gallery, /aria-modal="true"/);
  assert.match(gallery, /dictionary\.gallery\.dialog/);
  assert.match(gallery, /e\.key === "Escape"/);
  assert.match(gallery, /e\.key === "ArrowLeft"/);
  assert.match(gallery, /e\.key === "ArrowRight"/);
  assert.match(gallery, /e\.key === "Tab"/);
  assert.match(gallery, /botonAbrirRef\.current\?\.focus\(\)/);
});

test("gallery keeps responsive image loading and original ordering", () => {
  assert.match(gallery, /imagenesValidas\.map\(\(item, index\)/);
  assert.match(gallery, /sizes="\(max-width: 1280px\) 100vw, 60vw"/);
  assert.match(gallery, /className="object-cover/);
  assert.match(gallery, /className="object-contain"/);
});

test("desktop detail description follows the gallery without changing mobile content order", () => {
  assert.match(detail, /className="flex flex-col gap-12 xl:grid xl:grid-cols-\[1\.35fr_1fr\] xl:items-start"/);
  assert.match(detail, /className="contents xl:block xl:min-w-0"/);
  assert.match(detail, /className="order-3 max-w-4xl xl:mt-12"/);
  assert.match(detail, /className="order-2 min-w-0 xl:order-none"/);
  assert.equal(detail.match(/\{copy\.descriptionTitle\}/g)?.length, 1);
});
