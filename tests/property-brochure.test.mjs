import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import {
  buildPropertyBrochure,
  formatBrochurePrice,
  normalizePdfText,
  propertyBrochureMetrics,
} from "../lib/brochures/property-brochure.ts";
import { mapPropertyBrochureRow } from "../lib/brochures/property-brochure-data.ts";
import {
  BROCHURE_IMAGE_LIMITS,
  detectSupportedImageFormat,
  fetchPropertyBrochureImages,
  isApprovedPropertyImageUrl,
} from "../lib/brochures/property-brochure-images.ts";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function propertyFixture(overrides = {}) {
  return {
    title: "Casa de prueba en Ponce",
    slug: "casa-prueba-ponce",
    municipality: "Ponce",
    sector: "Coto Laurel",
    transactionType: "venta",
    propertyType: "Casa",
    status: "disponible",
    price: 146000,
    bedrooms: 3,
    bathrooms: 2,
    parking: 1,
    squareMeters: 125,
    description: "Primer párrafo de la propiedad.\n\nSegundo párrafo con más detalles.",
    featured: false,
    canonicalUrl: "https://borikipr.com/listados/casa-prueba-ponce",
    imageUrls: [],
    professional: {
      displayName: "Ivonne Erickson",
      avatarUrl: null,
      roleId: "real_estate_broker",
      licenseNumber: "C-25961",
      whatsappPhoneE164: "+17876774900",
    },
    ...overrides,
  };
}

test("brochure DTO is an explicit public-safe allowlist with clean canonical URL", () => {
  const mapped = mapPropertyBrochureRow({
    titulo: " Propiedad ", slug: "propiedad-ponce", municipio: " Ponce ", sector_comunidad: null,
    tipo_negocio: "venta", tipo_propiedad: "Casa", estado: "disponible", precio: "100000",
    habitaciones: 3, banos: 2, estacionamientos: 1, metros_cuadrados: 120,
    descripcion: " Descripción ", destacado: false, imagenes: ["https://img.borikipr.com/propiedades/a.jpg", null],
    listing_professional: null,
    account_email: "forbidden@example.com", notas_internas: "forbidden", configuracion_formulario: { private: true },
  });
  assert.deepEqual(Object.keys(mapped).sort(), [
    "bathrooms", "bedrooms", "canonicalUrl", "description", "featured", "imageUrls", "municipality",
    "parking", "price", "professional", "propertyType", "sector", "slug", "squareMeters", "status",
    "title", "transactionType",
  ].sort());
  assert.equal(mapped.canonicalUrl, "https://borikipr.com/listados/propiedad-ponce");
  assert.equal(JSON.stringify(mapped).includes("forbidden"), false);
});

test("professional projection duplicates the public fail-closed governance conditions", async () => {
  const data = await source("lib/brochures/property-brochure-data.ts");
  for (const condition of [
    /a\.activo = true/, /a\.account_state = 'active'/, /a\.public_profile_enabled = true/,
    /a\.public_profile_approval_state = 'approved'/, /professional_phone_whatsapp_enabled = true/,
    /'real_estate_broker' = ANY/, /'real_estate_salesperson' = ANY/,
  ]) assert.match(data, condition);
  for (const forbidden of ["account email", "recovery_email", "password_hash", "notas_internas", "configuracion_formulario", "lead_events"]) {
    assert.doesNotMatch(data, new RegExp(forbidden, "i"));
  }
});

test("image origin, formats, redirects, and size limits fail closed", async () => {
  assert.equal(isApprovedPropertyImageUrl("https://img.borikipr.com/propiedades/2026/a.jpg"), true);
  assert.equal(isApprovedPropertyImageUrl("https://img.borikipr.com.evil.test/propiedades/a.jpg"), false);
  assert.equal(isApprovedPropertyImageUrl("http://img.borikipr.com/propiedades/a.jpg"), false);
  assert.equal(isApprovedPropertyImageUrl("https://img.borikipr.com/testimonios/a.jpg"), false);

  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0, 1]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
  assert.equal(detectSupportedImageFormat(jpeg), "jpeg");
  assert.equal(detectSupportedImageFormat(png), "png");
  assert.equal(detectSupportedImageFormat(Uint8Array.from([1, 2, 3])), null);

  const safeFetch = async () => new Response(jpeg, { status: 200, headers: { "content-type": "image/jpeg" } });
  const assets = await fetchPropertyBrochureImages([
    "https://img.borikipr.com/propiedades/video.mp4",
    "https://img.borikipr.com/propiedades/photo.webp",
    "https://img.borikipr.com/propiedades/photo.jpg",
  ], safeFetch);
  assert.equal(assets.length, 1);
  assert.equal(assets[0].format, "jpeg");

  const unsafeRedirect = async () => new Response(null, { status: 302, headers: { location: "https://evil.test/a.jpg" } });
  assert.equal((await fetchPropertyBrochureImages(["https://img.borikipr.com/propiedades/a.jpg"], unsafeRedirect)).length, 0);
  const oversized = async () => new Response(jpeg, { status: 200, headers: { "content-length": String(BROCHURE_IMAGE_LIMITS.maxImageBytes + 1) } });
  assert.equal((await fetchPropertyBrochureImages(["https://img.borikipr.com/propiedades/a.jpg"], oversized)).length, 0);
});

test("land metrics suppress irrelevant zeros while residential metrics remain useful", () => {
  assert.deepEqual(propertyBrochureMetrics(propertyFixture({ propertyType: "Terreno", bedrooms: 0, bathrooms: 0, parking: 0, squareMeters: 0 })), [
    { label: "Tipo", value: "Terreno" },
  ]);
  assert.equal(propertyBrochureMetrics(propertyFixture()).length, 5);
  assert.equal(formatBrochurePrice(0, "venta"), "Precio próximamente");
  assert.equal(formatBrochurePrice(1200, "renta"), "$1,200/mes");
});

test("PDF generation is valid, selectable-text based, paginated, branded, and image-optional", async () => {
  const qr = new Uint8Array(await QRCode.toBuffer("https://borikipr.com/listados/casa-prueba-ponce", { type: "png" }));
  const shortResult = await buildPropertyBrochure({ property: propertyFixture(), images: [], qrPng: qr, logoPng: null });
  assert.equal(Buffer.from(shortResult.bytes).subarray(0, 4).toString(), "%PDF");
  assert.equal((await PDFDocument.load(shortResult.bytes)).getPageCount(), 2);

  const longResult = await buildPropertyBrochure({
    property: propertyFixture({
      title: "Una propiedad con un título deliberadamente extenso que debe envolver de forma segura",
      description: Array.from({ length: 40 }, (_, index) => `Párrafo ${index + 1}. ${"Contenido descriptivo seguro y seleccionable. ".repeat(6)}`).join("\n\n"),
    }),
    images: [{ bytes: qr, format: "png", sourceUrl: "https://img.borikipr.com/propiedades/qa.png" }, { bytes: qr, format: "png", sourceUrl: "https://img.borikipr.com/propiedades/qa-2.png" }],
    qrPng: qr,
    logoPng: null,
  });
  assert.ok(longResult.pageCount > 4);
  assert.equal((await PDFDocument.load(longResult.bytes)).getPageCount(), longResult.pageCount);
  assert.equal(normalizePdfText("Café — Borikí\u0000"), "Café - Borikí");
  assert.equal(normalizePdfText("𝐔𝐛𝐢𝐜𝐚𝐝𝐚 𝐞𝐧 𝐂𝐨𝐭𝐨 𝐋𝐚𝐮𝐫𝐞𝐥"), "Ubicada en Coto Laurel");

  const renderer = await source("lib/brochures/property-brochure.ts");
  assert.match(renderer, /page\.drawText/);
  assert.doesNotMatch(renderer, /signatures\//);
});

test("route and Admin action enforce the locked architecture", async () => {
  const [route, actions, imageModule] = await Promise.all([
    source("app/api/admin/propiedades/[id]/brochure/route.ts"),
    source("app/admin/propiedades/PropiedadRowActions.tsx"),
    source("lib/brochures/property-brochure-images.ts"),
  ]);
  assert.match(actions, /Ver en sitio[\s\S]*Generar brochure[\s\S]*Enlace privado de visita/);
  assert.match(actions, /\/api\/admin\/propiedades\/\$\{id\}\/brochure/);
  assert.match(actions, /_blank/);
  assert.match(route, /requireModuleAccess\("properties", "view"\)/);
  assert.match(route, /Content-Type": "application\/pdf"/);
  assert.match(route, /Content-Disposition": `inline;/);
  assert.match(route, /Cache-Control": "private, no-store"/);
  assert.match(route, /X-Robots-Tag": "noindex"/);
  assert.match(route, /QRCode\.toBuffer\(property\.canonicalUrl/);
  assert.doesNotMatch(route, /utm_|property-share|signatures\//i);
  assert.doesNotMatch(`${route}\n${imageModule}`, /PutObject|INSERT|UPDATE|DELETE FROM|cron|scheduler|\/api\/track/i);
});
