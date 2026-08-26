import assert from "node:assert/strict";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { finalizePrototypePdf } from "../lib/signatures/prototype/finalize.ts";
import { sha256Hex } from "../lib/signatures/prototype/hash.ts";
import { normalizeSignerCapture } from "../lib/signatures/signer/capture.ts";
import { SIGNATURE_STYLES, deriveSuggestedInitials } from "../lib/signatures/signature-styles.ts";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = (file) => readFile(path.join(root, file), "utf8");
const fontPaths = Object.fromEntries(SIGNATURE_STYLES.map((style) => [
  style.id,
  path.join(root, "public", ...style.publicPath.split("/").filter(Boolean)),
]));

test("five bundled OFL signature styles are distinct and deterministic", async () => {
  assert.equal(SIGNATURE_STYLES.length, 5);
  assert.equal(new Set(SIGNATURE_STYLES.map((style) => style.id)).size, 5);
  assert.equal(deriveSuggestedInitials("Cedric J Santiago Erickson"), "CJSE");
  for (const style of SIGNATURE_STYLES) {
    await access(fontPaths[style.id]);
    await access(path.join(path.dirname(fontPaths[style.id]), "OFL.txt"));
  }
});

test("typed signature style is validated and bound into immutable value evidence", () => {
  const classic = normalizeSignerCapture("signature", {
    method: "typed", value: "Cedric J Santiago Erickson", style: "great-vibes",
  });
  const fluid = normalizeSignerCapture("signature", {
    method: "typed", value: "Cedric J Santiago Erickson", style: "allura",
  });
  assert.equal(classic.captureMethod, "typed");
  assert.deepEqual(classic.valuePayload, { styleId: "great-vibes" });
  assert.equal(classic.signatureStyleId, "great-vibes");
  assert.notEqual(classic.valueSha256, fluid.valueSha256);
  assert.throws(() => normalizeSignerCapture("signature", {
    method: "typed", value: "Cedric J Santiago Erickson", style: "forged-style",
  }), /signature_style_invalid/);
});

test("all adopted styles embed deterministically in the clean final PDF", async () => {
  const sourceDocument = await PDFDocument.create();
  const page = sourceDocument.addPage([612, 792]);
  const body = await sourceDocument.embedFont(StandardFonts.Helvetica);
  page.drawText("Boriki Sign signature-style visual fixture", { x: 42, y: 742, size: 14, font: body });
  const sourceBytes = await sourceDocument.save({ useObjectStreams: false });
  const geometry = { pageIndex: 0, mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 }, rotation: 0, userUnit: 1 };
  const fields = SIGNATURE_STYLES.map((style, index) => ({
    id: `style-${index + 1}`, participantId: "participant-1",
    type: index === SIGNATURE_STYLES.length - 1 ? "initials" : "signature",
    pageIndex: 0, rect: { x: 0.08, y: 0.13 + index * 0.13, width: 0.58, height: 0.09 },
    value: { method: "typed", value: index === SIGNATURE_STYLES.length - 1 ? "CJSE" : "Cedric J Santiago Erickson", style: style.id },
  }));
  const result = await finalizePrototypePdf({
    sourceBytes, sourceTitle: "Signature style fixture", sourceSha256: sha256Hex(sourceBytes),
    geometries: [geometry], fields,
    participants: [{ id: "participant-1", displayName: "Cedric J Santiago Erickson", role: "Comprador", completedAt: "2031-01-05T12:00:00.000Z" }],
    requestId: "request-style-fixture", verificationId: "verification-style-fixture",
    consentVersion: "consent-style-fixture", completedAt: "2031-01-05T12:00:00.000Z",
    typedSignatureFontPaths: fontPaths,
  });
  assert.equal((await PDFDocument.load(result.finalBytes)).getPageCount(), 1);
  assert.deepEqual(result.manifest.fieldCaptures.map((capture) => capture.adoptedStyle), SIGNATURE_STYLES.map((style) => style.id));
  assert.equal(new Set(result.manifest.fieldCaptures.map((capture) => capture.captureSha256)).size, 5);
  if (process.env.SIGNATURE_STYLE_ARTIFACT_DIR) {
    const output = path.resolve(process.env.SIGNATURE_STYLE_ARTIFACT_DIR);
    await mkdir(output, { recursive: true });
    await writeFile(path.join(output, "phase3c-styled-signatures.pdf"), result.finalBytes);
  }
});

test("signer UI exposes accessible typed and drawn adoption without external generators", async () => {
  const [form, stylesheet, route] = await Promise.all([
    source("app/firmar/sesion/SignerFieldForm.tsx"), source("app/firmar/signature-fonts.css"),
    source("app/api/signatures/session/field/route.ts"),
  ]);
  assert.match(form, /Adoptar y continuar/);
  assert.match(form, /role="tab"/);
  assert.match(form, /aria-pressed=\{selected\}/);
  assert.match(form, /Limpiar/);
  assert.match(stylesheet, /\/fonts\/signatures\/great-vibes/);
  assert.match(route, /isSignatureStyleId/);
  assert.doesNotMatch(`${form}\n${route}`, /fetch\(|https?:\/\//);
});

test("drawn initials render as bounded vector evidence in the final PDF", async () => {
  const sourceDocument = await PDFDocument.create();
  sourceDocument.addPage([320, 180]);
  const sourceBytes = await sourceDocument.save({ useObjectStreams: false });
  const result = await finalizePrototypePdf({
    sourceBytes, sourceTitle:"Drawn initials fixture", sourceSha256:sha256Hex(sourceBytes),
    geometries:[{pageIndex:0,mediaBox:{x:0,y:0,width:320,height:180},cropBox:{x:0,y:0,width:320,height:180},rotation:0,userUnit:1}],
    fields:[{id:"initials-drawn",participantId:"participant-1",type:"initials",pageIndex:0,rect:{x:.15,y:.25,width:.24,height:.18},value:{method:"drawn",strokes:[[{x:.08,y:.8},{x:.25,y:.15},{x:.45,y:.82}],[{x:.55,y:.78},{x:.72,y:.2},{x:.9,y:.72}]]}}],
    participants:[{id:"participant-1",displayName:"Synthetic Signer",role:"Comprador",completedAt:"2031-01-05T12:00:00.000Z"}],requestId:"drawn-initials-fixture",verificationId:"drawn-initials-verification",consentVersion:"fixture-consent",completedAt:"2031-01-05T12:00:00.000Z",
  });
  assert.equal((await PDFDocument.load(result.finalBytes)).getPageCount(),1);
  assert.equal(result.manifest.fieldCaptures[0].captureMethod,"drawn");
  assert.ok(result.finalBytes.byteLength>sourceBytes.byteLength);
});
