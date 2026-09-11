import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const home = fs.readFileSync("app/(public)/page.tsx", "utf8");
const quote = fs.readFileSync("components/HomeTestimonialQuote.tsx", "utf8");
const es = fs.readFileSync("locales/es-PR.ts", "utf8");
const en = fs.readFileSync("locales/en-US.ts", "utf8");
const gallery = fs.readFileSync("components/GaleriaPropiedad.tsx", "utf8");

test("Home featured property metrics keep zero values and add accessible bed and bath icons", () => {
  assert.match(home, /item\.habitaciones !== null && item\.habitaciones !== undefined/);
  assert.match(home, /item\.banos !== null && item\.banos !== undefined/);
  assert.match(home, /<BedDouble[\s\S]*aria-hidden="true"/);
  assert.match(home, /<Bath[\s\S]*aria-hidden="true"/);
  assert.match(home, /aria-label={`\$\{copy\.listings\.bedrooms\}: \$\{item\.habitaciones\}`}/);
  assert.match(home, /aria-label={`\$\{copy\.listings\.bathrooms\}: \$\{item\.banos\}`}/);
  assert.match(home, /<span>{item\.tipo_propiedad}<\/span>/);
});

test("Home uses quantity-aware centered layouts without changing multi-card columns", () => {
  assert.match(home, /destacadas\.length === 1[\s\S]*mx-auto max-w-\[30rem\]/);
  assert.match(home, /destacadas\.length === 2[\s\S]*md:max-w-5xl md:grid-cols-2/);
  assert.match(home, /md:grid-cols-2 2xl:grid-cols-3/);
  assert.match(home, /testimoniosHome\.length === 1[\s\S]*mx-auto max-w-\[32rem\]/);
  assert.match(home, /testimoniosHome\.length === 2[\s\S]*md:max-w-4xl md:grid-cols-2/);
  assert.match(home, /md:grid-cols-3/);
});

test("Home testimonial toggle is rendered only after real visual overflow is measured", () => {
  assert.match(home, /<HomeTestimonialQuote/);
  assert.match(quote, /quote\.scrollHeight > quote\.clientHeight \+ 1/);
  assert.match(quote, /new ResizeObserver\(measureOverflow\)/);
  assert.match(quote, /\{isTruncated && \(/);
  assert.match(quote, /aria-expanded=\{expanded\}/);
  assert.match(quote, /aria-controls=\{quoteId\}/);
  assert.match(quote, /expanded \? readLessLabel : readMoreLabel/);
  assert.doesNotMatch(quote, /modal|accordion|window\.location/i);
});

test("Home testimonial toggle and metric labels are localized in both dictionaries", () => {
  assert.match(es, /readMore: "Ver más"/);
  assert.match(es, /readLess: "Ver menos"/);
  assert.match(es, /bedrooms: "Habitaciones"/);
  assert.match(es, /bathrooms: "Baños"/);
  assert.match(en, /readMore: "Read more"/);
  assert.match(en, /readLess: "Read less"/);
  assert.match(en, /bedrooms: "Bedrooms"/);
  assert.match(en, /bathrooms: "Bathrooms"/);
});

test("The existing property gallery filmstrip supplies an accurate responsive sizes hint", () => {
  assert.match(gallery, /sizes="\(min-width: 640px\) 96px, 80px"/);
});
