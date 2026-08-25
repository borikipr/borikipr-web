import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { normalizeSignerCapture } from "../lib/signatures/signer/capture.ts";
import { evaluateSignatureVisualPreflight } from "../lib/signatures/visual-preflight.ts";
import { inspectPdfCompatibility } from "../lib/signatures/prototype/inspect.ts";
import { finalizePrototypePdf } from "../lib/signatures/prototype/finalize.ts";

const root = process.cwd();

test("practical fields normalize valid values into immutable evidence inputs", () => {
  assert.equal(normalizeSignerCapture("checkbox", { method: "text", value: "true" }).typedValue, "true");
  assert.equal(normalizeSignerCapture("radio", { method: "text", value: "Efectivo" }, { options: ["Efectivo", "Financiado"] }).typedValue, "Efectivo");
  assert.equal(normalizeSignerCapture("dropdown", { method: "text", value: "Sí" }, { options: ["Sí", "No"] }).typedValue, "Sí");
  assert.equal(normalizeSignerCapture("date", { method: "date", value: "2026-08-25" }).typedValue, "2026-08-25");
  assert.equal(normalizeSignerCapture("number", { method: "text", value: "1.25" }, { min: 0, max: 2 }).typedValue, "1.25");
  assert.equal(normalizeSignerCapture("email", { method: "text", value: "signer@example.test" }).typedValue, "signer@example.test");
  assert.equal(normalizeSignerCapture("phone", { method: "text", value: "+1 (787) 555-0100" }).typedValue, "+1 (787) 555-0100");
});

test("practical fields reject invalid, ambiguous, or client-authored system values", () => {
  assert.throws(() => normalizeSignerCapture("checkbox", { method: "text", value: "false" }), /checkbox_required/);
  assert.throws(() => normalizeSignerCapture("radio", { method: "text", value: "Ambos" }, { options: ["Sí", "No"] }), /choice_invalid/);
  assert.throws(() => normalizeSignerCapture("dropdown", { method: "text", value: "<script>" }, { options: ["Sí", "No"] }));
  assert.throws(() => normalizeSignerCapture("date", { method: "date", value: "2026-02-31" }), /date_invalid/);
  assert.throws(() => normalizeSignerCapture("number", { method: "text", value: "1.2" }, { allowDecimals: false }), /decimals_invalid/);
  assert.throws(() => normalizeSignerCapture("number", { method: "text", value: "11" }, { max: 10 }), /number_max/);
  assert.throws(() => normalizeSignerCapture("email", { method: "text", value: "invalid" }), /email_invalid/);
  assert.throws(() => normalizeSignerCapture("phone", { method: "text", value: "123" }), /phone_invalid/);
  assert.throws(() => normalizeSignerCapture("signer_name", { method: "text", value: "Injected" }), /capture_type_mismatch/);
});

test("preflight understands choice configuration and practical-field geometry", () => {
  const result = evaluateSignatureVisualPreflight([
    { id: "checkbox", fieldType: "checkbox", pageIndex: 0, normalizedX: .1, normalizedY: .1, normalizedWidth: .01, normalizedHeight: .01 },
    { id: "radio", fieldType: "radio", pageIndex: 0, normalizedX: .2, normalizedY: .2, normalizedWidth: .2, normalizedHeight: .06, validationLimits: { options: ["Sí"] } },
    { id: "dropdown", fieldType: "dropdown", pageIndex: 0, normalizedX: .5, normalizedY: .2, normalizedWidth: .15, normalizedHeight: .05, validationLimits: { options: ["Una opción muy larga para este campo", "Otra"] } },
  ]);
  assert.equal(result.sendBlocked, true);
  assert.ok(result.issues.some((issue) => issue.fieldIds.includes("checkbox") && issue.severity === "critical"));
  assert.ok(result.issues.some((issue) => issue.fieldIds.includes("radio") && /dos opciones/.test(issue.message)));
  assert.ok(result.issues.some((issue) => issue.fieldIds.includes("dropdown") && issue.severity === "warning"));
});

test("checkbox and choice values render without adding pages or editor chrome", async () => {
  const document = await PDFDocument.create();
  document.addPage([612, 792]);
  const sourceBytes = new Uint8Array(await document.save({ useObjectStreams: false }));
  const inspection = await inspectPdfCompatibility({ bytes: sourceBytes, mimeType: "application/pdf", limits: { maximumSourceBytes: 1_000_000, maximumPages: 2 } });
  const fields = [
    { id: "a", participantId: "p", type: "checkbox", pageIndex: 0, rect: { x: .1, y: .1, width: .04, height: .04 }, value: { method: "checkbox", value: true } },
    { id: "b", participantId: "p", type: "radio", pageIndex: 0, rect: { x: .2, y: .1, width: .2, height: .05 }, value: { method: "text", value: "Efectivo" } },
    { id: "c", participantId: "p", type: "date", pageIndex: 0, rect: { x: .2, y: .2, width: .2, height: .05 }, value: { method: "date", value: "2026-08-25" } },
  ];
  const result = await finalizePrototypePdf({ sourceBytes, sourceTitle: "Practical fields", sourceSha256: inspection.sourceSha256, geometries: inspection.pages, fields, participants: [{ id: "p", displayName: "Synthetic", role: "Comprador", completedAt: "2026-08-25T12:00:00.000Z" }], requestId: "request", verificationId: "verification", consentVersion: "consent", completedAt: "2026-08-25T12:00:00.000Z" });
  const finalDocument = await PDFDocument.load(result.finalBytes);
  assert.equal(finalDocument.getPageCount(), 1);
  assert.match(result.manifest.finalPdfSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.manifest.fieldCaptures.map((item) => item.fieldType), ["checkbox", "radio", "date"]);
});

test("template blueprint retains options and geometry but strips all participant values", async () => {
  const productization = await readFile(path.join(root, "lib/signatures/productization.ts"), "utf8");
  const migration = await readFile(path.join(root, "db/migrations/0038_add_signature_practical_fields.sql"), "utf8");
  assert.match(productization, /validationLimits:field\.validationLimits/);
  assert.doesNotMatch(productization, /sanitized_typed_value|signature_field_values/);
  assert.match(migration, /'checkbox','radio'/);
  assert.match(migration, /system_identity/);
});

test("signer form uses semantic mobile-friendly controls", async () => {
  const source = await readFile(path.join(root, "app/firmar/sesion/SignerFieldForm.tsx"), "utf8");
  assert.match(source, /type="checkbox"/);
  assert.match(source, /type="radio"/);
  assert.match(source, /<fieldset/);
  assert.match(source, /type=\{field\.field_type === "date" \? "date"/);
  assert.match(source, /inputMode=.*"decimal"/s);
  assert.match(source, /autoComplete=.*"email"/s);
  assert.match(source, /autoComplete=.*"tel"/s);
});

test("Admin media upload offers shared drag-drop, strict purpose validation, and accessible ordering", async () => {
  const [dropZone, manager, route, createAction, queries] = await Promise.all([
    readFile(path.join(root, "components/admin/MediaDropZone.tsx"), "utf8"),
    readFile(path.join(root, "app/admin/propiedades/PropertyMediaManager.tsx"), "utf8"),
    readFile(path.join(root, "app/api/admin/upload/route.ts"), "utf8"),
    readFile(path.join(root, "app/admin/propiedades/actions.ts"), "utf8"),
    readFile(path.join(root, "lib/queries/propiedades.ts"), "utf8"),
  ]);
  assert.match(dropZone, /onDragEnter/); assert.match(dropZone, /onDrop/); assert.match(dropZone, /type="file"/); assert.match(dropZone, /multiple=\{multiple\}/);
  assert.match(manager, /draggable/); assert.match(manager, /Usar como portada/); assert.match(manager, /Mover imagen/);
  assert.match(route, /verifyAdminSessionValue/); assert.match(route, /sameSignerOrigin/); assert.match(route, /matchesDeclaredType/); assert.match(route, /purpose === "testimonial"/); assert.match(route, /"testimonios"/);
  assert.match(createAction, /INSERT INTO public\.propiedad_imagenes \(propiedad_id, url, orden\)/);
  assert.match(createAction, /DELETE FROM public\.propiedad_imagenes WHERE propiedad_id/);
  assert.match(createAction, /for \(let i = 0; i < imagenes\.length; i\+\+\)/);
  assert.match(createAction, /\[id, imagenes\[i\], i \+ 1\]/);
  assert.match(queries, /json_agg\(pi\.url ORDER BY pi\.orden\)/);
});
