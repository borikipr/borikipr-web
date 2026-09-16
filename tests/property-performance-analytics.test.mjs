import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  actionRate,
  aggregatePropertyCoreRows,
  buildPropertyPerformanceDisplayRows,
  mergePropertyArrivalRows,
  mergePropertyShareRows,
  totalSuccessfulForms,
} from "../lib/admin/analytics/property-performance.ts";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

function row(dimensions, metric) {
  return {
    dimensionValues: dimensions.map((value) => ({ value })),
    metricValues: [{ value: String(metric) }],
  };
}

test("property core aggregation covers views, contacts, forms, and shares", () => {
  const grouped = aggregatePropertyCoreRows([
    row(["casa", "property_view"], 20),
    row(["casa", "property_whatsapp_click"], 4),
    row(["casa", "property_contact_click"], 2),
    row(["casa", "priority_registration_submit_success"], 1),
    row(["casa", "buyer_profile_form_submit_success"], 2),
    row(["casa", "property_showing_profile_submit_success"], 3),
    row(["casa", "property_share"], 7),
    row(["(not set)", "property_view"], 99),
  ]);
  const metric = grouped.get("casa");
  assert.ok(metric);
  assert.equal(metric.views, 20);
  assert.equal(metric.whatsappClicks, 4);
  assert.equal(metric.contactClicks, 2);
  assert.equal(metric.shares, 7);
  assert.equal(totalSuccessfulForms(metric), 6);
});

test("share channel and UTM arrival reports merge without per-property queries", () => {
  const grouped = aggregatePropertyCoreRows([row(["casa", "property_view"], 10)]);
  mergePropertyShareRows(grouped, [
    row(["casa", "whatsapp"], 2),
    row(["casa", "facebook"], 1),
    row(["casa", "copy"], 3),
    row(["casa", "qr"], 4),
    row(["casa", "unsupported"], 50),
  ]);
  mergePropertyArrivalRows(grouped, [
    row(["whatsapp", "share", "property_share", "casa"], 8),
  ]);
  const metric = grouped.get("casa");
  assert.deepEqual(metric.shareChannels, {
    whatsapp: 2,
    facebook: 1,
    copy: 3,
    qr: 4,
  });
  assert.equal(metric.sharedLinkArrivals, 8);
});

test("metadata join preserves current zero rows and historical unmatched slugs", () => {
  const grouped = aggregatePropertyCoreRows([
    row(["actual", "property_view"], 10),
    row(["historica", "property_view"], 3),
    row(["actual", "property_whatsapp_click"], 2),
  ]);
  const rows = buildPropertyPerformanceDisplayRows([...grouped.values()], [
    { slug: "actual", title: "Casa actual", status: "disponible", municipality: "Ponce" },
    { slug: "sin-actividad", title: "Terreno nuevo", status: "proximamente", municipality: "Guánica" },
  ]);
  assert.equal(rows.find((item) => item.propertySlug === "sin-actividad")?.views, 0);
  assert.equal(rows.find((item) => item.propertySlug === "historica")?.historical, true);
  assert.equal(rows.find((item) => item.propertySlug === "actual")?.contactActionRate, 0.2);
  assert.equal(actionRate(1, 0), null);
});

test("provider uses exactly three bounded aggregate reports and range-specific cache", async () => {
  const [provider, cache] = await Promise.all([
    read("lib/admin/analytics/providers/ga4.ts"),
    read("lib/admin/analytics/cache.ts"),
  ]);
  const propertyBlock = provider.slice(
    provider.indexOf("async function fetchGa4PropertyDigitalInterest"),
    provider.indexOf("export const ga4Provider")
  );
  assert.equal((propertyBlock.match(/client\.runReport/g) ?? []).length, 3);
  assert.match(propertyBlock, /customEvent:property_slug/);
  assert.match(propertyBlock, /customEvent:share_channel/);
  assert.match(propertyBlock, /sessionManualSource/);
  assert.match(propertyBlock, /sessionManualMedium/);
  assert.match(propertyBlock, /sessionManualCampaignName/);
  assert.match(propertyBlock, /sessionManualAdContent/);
  assert.match(propertyBlock, /value: "share"/);
  assert.match(propertyBlock, /value: "property_share"/);
  assert.match(propertyBlock, /unstable_cache/);
  assert.match(propertyBlock, /\["ga4-property-performance", range\]/);
  assert.match(cache, /case "today":\s+return 120/);
  assert.match(cache, /case "90d":\s+default:\s+return 1800/);
});

test("provider distinguishes unavailable and partial GA4 results", async () => {
  const [provider, types] = await Promise.all([
    read("lib/admin/analytics/providers/ga4.ts"),
    read("lib/admin/analytics/property-performance.ts"),
  ]);
  assert.match(types, /status: "available"/);
  assert.match(types, /status: "partial"/);
  assert.match(types, /status: "unavailable"/);
  assert.match(provider, /missing_custom_dimension/);
  assert.match(provider, /Promise\.allSettled/);
  assert.doesNotMatch(provider, /GA4 property digital interest unavailable[\s\S]*return \[\]/);
});

test("metadata query is narrow and performs no analytics write or heavy join", async () => {
  const metadata = await read("lib/admin/analytics/property-metadata.ts");
  assert.match(metadata, /SELECT slug, titulo, estado, municipio/);
  assert.doesNotMatch(metadata, /lead_events|propiedad_imagenes|INSERT|UPDATE|DELETE/i);
  assert.equal((metadata.match(/sql</g) ?? []).length, 1);
});

test("property performance UI is compact, responsive, aggregate, and non-PII", async () => {
  const [page, component] = await Promise.all([
    read("app/admin/analytics/ga4/page.tsx"),
    read("components/admin/analytics/PropertyPerformanceSection.tsx"),
  ]);
  assert.match(page, /<PropertyPerformanceSection/);
  assert.ok(page.indexOf("<PropertyPerformanceSection") < page.indexOf("<div className=\"grid gap-5"));
  assert.match(component, /Rendimiento por propiedad/);
  assert.match(component, /hidden overflow-x-auto[\s\S]*md:block/);
  assert.match(component, /md:hidden/);
  assert.match(component, /Ver desglose/);
  assert.match(component, /Visitas desde enlaces compartidos/);
  assert.match(component, /Histórico \/ ya no coincide con inventario actual/);
  assert.match(component, /No disponible/);
  assert.match(component, /Sin historial|Share Kit esté activo/);
  assert.doesNotMatch(component, /visitor_email|visitor_phone|client_id|user_id|ip_address/i);
});

test("local fixture is development-only and cannot weaken production authentication", async () => {
  const page = await read("app/admin/analytics/ga4/page.tsx");
  assert.match(page, /process\.env\.NODE_ENV === "development"/);
  assert.match(page, /propertyPerformanceFixture === "1"/);
  assert.doesNotMatch(page, /GA4_PRIVATE_KEY|private_key/);
});

test("Phase 9.1 and 9.3 remain isolated from property performance", async () => {
  const [share, brochure, provider, metadata] = await Promise.all([
    read("components/PropertyShareKit.tsx"),
    read("lib/brochures/property-brochure.ts"),
    read("lib/admin/analytics/providers/ga4.ts"),
    read("lib/admin/analytics/property-metadata.ts"),
  ]);
  assert.match(share, /trackAnalyticsEvent\(\s*"property_share"/);
  assert.match(brochure, /PDFDocument/);
  assert.doesNotMatch(`${provider}\n${metadata}`, /lib\/brochures|PropertyShareKit/);
  assert.doesNotMatch(`${provider}\n${metadata}`, /lead_events|api\/track/);
});
