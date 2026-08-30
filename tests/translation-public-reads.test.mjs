import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test, { after, before } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  applyPropertyTranslationOverlay,
  applyTestimonialTranslationOverlay,
  overlayPropertyTranslations,
  overlayTestimonialTranslations,
} from "../lib/i18n/translations/public-overlay.ts";
import {
  getEnglishPublicTranslationPaths,
  invalidateEnglishPublicTranslationPaths,
} from "../lib/i18n/translations/public-revalidation.ts";
import { createTranslationRepository } from "../lib/i18n/translations/repository.ts";

const HASH = "a".repeat(64);
const OLD_HASH = "b".repeat(64);
const property = { id: "00000000-0000-4000-8000-000000000001", titulo: "Casa", descripcion: "Descripcion", precio: 10 };

function row(fieldKey, overrides = {}) {
  return {
    ownerId: property.id,
    fieldKey,
    status: "ready",
    translatedValue: fieldKey === "title" ? "House" : "Description",
    sourceHash: HASH,
    translatedSourceHash: HASH,
    ...overrides,
  };
}

test("public property overlay publishes only current, non-empty ready values field by field", () => {
  const states = ["pending", "processing", "stale", "failed"];
  for (const status of states) {
    assert.equal(applyPropertyTranslationOverlay([property], [row("title", { status })])[0].titulo, "Casa");
  }
  assert.equal(applyPropertyTranslationOverlay([property], [])[0].titulo, "Casa");
  assert.equal(applyPropertyTranslationOverlay([property], [row("title", { translatedValue: "  " })])[0].titulo, "Casa");
  assert.equal(applyPropertyTranslationOverlay([property], [row("title", { translatedSourceHash: OLD_HASH })])[0].titulo, "Casa");
  assert.equal(applyPropertyTranslationOverlay([property], [row("title", { status: "stale", protectedFromAutomation: true })])[0].titulo, "Casa");

  const result = applyPropertyTranslationOverlay([property], [row("title")])[0];
  assert.deepEqual(result, { ...property, titulo: "House" });
  assert.equal(property.titulo, "Casa");
  assert.equal(property.descripcion, "Descripcion");
});

test("public testimonial overlay publishes ready bodies and otherwise preserves source values", () => {
  const testimonial = { id: "00000000-0000-4000-8000-000000000002", texto: "Excelente", nombre: "Ana" };
  const ready = { ...row("body"), ownerId: testimonial.id, translatedValue: "Excellent" };
  assert.equal(applyTestimonialTranslationOverlay([testimonial], [ready])[0].texto, "Excellent");
  assert.equal(applyTestimonialTranslationOverlay([testimonial], [{ ...ready, status: "stale" }])[0].texto, "Excelente");
  assert.equal(testimonial.texto, "Excelente");
});

test("Spanish overlays issue zero translation reads; English uses one allowlisted batch read", async () => {
  const calls = [];
  const reader = {
    async fetchPropertyTranslations(ids, locale, fields) {
      calls.push(["property", ids, locale, fields]);
      return [row("title")];
    },
    async fetchTestimonialTranslations(ids, locale, fields) {
      calls.push(["testimonial", ids, locale, fields]);
      return [];
    },
  };
  await overlayPropertyTranslations({ properties: [property], locale: "es-PR", reader });
  await overlayTestimonialTranslations({ testimonials: [], locale: "es-PR", reader });
  assert.equal(calls.length, 0);

  await overlayPropertyTranslations({ properties: [property, property], locale: "en-US", reader });
  await overlayTestimonialTranslations({ testimonials: [{ id: "00000000-0000-4000-8000-000000000002", texto: "Bien" }], locale: "en-US", reader });
  assert.deepEqual(calls, [
    ["property", [property.id], "en-US", ["title", "description"]],
    ["testimonial", ["00000000-0000-4000-8000-000000000002"], "en-US", ["body"]],
  ]);
});

test("card-only property overlays request titles without description translations", async () => {
  const calls = [];
  const reader = {
    async fetchPropertyTranslations(ids, locale, fields) {
      calls.push([ids, locale, fields]);
      return [row("title")];
    },
    async fetchTestimonialTranslations() {
      return [];
    },
  };
  const cards = await overlayPropertyTranslations({
    properties: [{ id: property.id, titulo: "Casa", precio: 10 }],
    locale: "en-US",
    reader,
  });
  assert.equal(cards[0].titulo, "House");
  assert.deepEqual(calls, [[[property.id], "en-US", ["title"]]]);
});

test("English public invalidation is entity-aware, feature-gated, and propagates failures", async () => {
  assert.deepEqual(getEnglishPublicTranslationPaths({ entityType: "property", ownerId: property.id, propertySlug: "casa" }), ["/en", "/en/listings", "/sitemap.xml", "/en/listings/casa"]);
  assert.deepEqual(getEnglishPublicTranslationPaths({ entityType: "testimonial", ownerId: property.id }), ["/en", "/en/testimonials"]);
  const paths = [];
  assert.deepEqual(await invalidateEnglishPublicTranslationPaths({ target: { entityType: "property", ownerId: property.id, propertySlug: "casa" }, multilingualEnabled: false, revalidate: (path) => paths.push(path) }), []);
  assert.deepEqual(paths, []);
  await assert.rejects(() => invalidateEnglishPublicTranslationPaths({ target: { entityType: "testimonial", ownerId: property.id }, multilingualEnabled: true, revalidate: () => { throw new Error("cache unavailable"); } }), /cache unavailable/);
});

const migration19 = await readFile(fileURLToPath(new URL("../db/migrations/0019_create_translation_persistence.sql", import.meta.url)), "utf8");
const migration20 = await readFile(fileURLToPath(new URL("../db/migrations/0020_add_translation_regeneration_authorization.sql", import.meta.url)), "utf8");
const db = new PGlite();
let repository;

before(async () => {
  await db.exec(`
    CREATE TABLE public.propiedades (id uuid PRIMARY KEY, titulo text NOT NULL, descripcion text NOT NULL);
    CREATE TABLE public.testimonios (id uuid PRIMARY KEY, texto text NOT NULL);
    CREATE TABLE public.admin_users (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  `);
  await db.exec(migration19);
  await db.exec(migration20);
  const database = {
    unsafe: async (query, parameters = []) => (await db.query(query, parameters)).rows,
    begin: (callback) => db.transaction((tx) => callback({ unsafe: async (query, parameters = []) => (await tx.query(query, parameters)).rows })),
  };
  repository = createTranslationRepository(database);
});

after(async () => db.close());

test("isolated migrated repository batch reads preserve ownership and publication rules", async () => {
  const p1 = property.id;
  const p2 = "00000000-0000-4000-8000-000000000003";
  const p3 = "00000000-0000-4000-8000-000000000004";
  const p4 = "00000000-0000-4000-8000-000000000005";
  const p5 = "00000000-0000-4000-8000-000000000006";
  const t1 = "00000000-0000-4000-8000-000000000002";
  const t2 = "00000000-0000-4000-8000-000000000007";
  const t3 = "00000000-0000-4000-8000-000000000008";
  await db.query("INSERT INTO propiedades (id,titulo,descripcion) VALUES ($1,'Casa','Descripcion'),($2,'Villa','Texto'),($3,'Casa stale','Stale'),($4,'Casa failed','Failed'),($5,'Casa missing','Missing')", [p1, p2, p3, p4, p5]);
  await db.query("INSERT INTO testimonios (id,texto) VALUES ($1,'Excelente'),($2,'Antiguo'),($3,'Sin fila')", [t1, t2, t3]);
  await db.query(`INSERT INTO content_translations (property_id,target_locale,field_key,translated_value,source_hash,translated_source_hash,status,origin,protected_from_automation) VALUES ($1,'en-US','title','House',$5,$5,'ready','machine',false),($1,'en-US','description','Old description',$5,$6,'ready','machine',false),($2,'en-US','title','Villa EN',$5,$5,'ready','machine',false),($3,'en-US','title','Stale house',$5,$5,'stale','manual',true),($4,'en-US','title',NULL,$5,NULL,'failed','machine',false)`, [p1, p2, p3, p4, HASH, OLD_HASH]);
  await db.query(`INSERT INTO content_translations (testimonial_id,target_locale,field_key,translated_value,source_hash,translated_source_hash,status) VALUES ($1,'en-US','body','Excellent',$2,$2,'ready')`, [t1, HASH]);
  await db.query(`INSERT INTO content_translations (testimonial_id,target_locale,field_key,translated_value,source_hash,translated_source_hash,status) VALUES ($1,'en-US','body','Old testimonial',$2,$2,'stale')`, [t2, HASH]);

  const properties = await overlayPropertyTranslations({ properties: [property, { id: p2, titulo: "Villa", descripcion: "Texto" }, { id: p3, titulo: "Casa stale", descripcion: "Stale" }, { id: p4, titulo: "Casa failed", descripcion: "Failed" }, { id: p5, titulo: "Casa missing", descripcion: "Missing" }], locale: "en-US", reader: repository });
  assert.deepEqual(properties.map(({ titulo, descripcion }) => [titulo, descripcion]), [["House", "Descripcion"], ["Villa EN", "Texto"], ["Casa stale", "Stale"], ["Casa failed", "Failed"], ["Casa missing", "Missing"]]);
  const testimonials = await overlayTestimonialTranslations({ testimonials: [{ id: t1, texto: "Excelente" }, { id: t2, texto: "Antiguo" }, { id: t3, texto: "Sin fila" }], locale: "en-US", reader: repository });
  assert.deepEqual(testimonials.map(({ texto }) => texto), ["Excellent", "Antiguo", "Sin fila"]);
});

test("public route wiring stays shared, gated, display-safe, and provider-free", async () => {
  const read = async (path) => readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
  const [layout, englishDetail, sharedDetail, overlay] = await Promise.all([
    read("app/(public)/en/layout.tsx"),
    read("app/(public)/en/listings/[slug]/page.tsx"),
    read("app/(public)/listados/[slug]/page.tsx"),
    read("lib/i18n/translations/public-overlay.ts"),
  ]);
  assert.match(layout, /isMultilingualEnabled\(\)/);
  assert.match(englishDetail, /isMultilingualEnabled\(\)/);
  assert.match(englishDetail, /notFound\(\)/);
  assert.match(englishDetail, /renderPropertyDetailPage/);
  assert.doesNotMatch(englishDetail, /<main|content_translations|sourceHash/);
  assert.match(sharedDetail, /overlayPropertyTranslations/);
  assert.doesNotMatch(overlay, /provider|translation_jobs|reviewStatus|regenerationAuthorizedAt/);
});
