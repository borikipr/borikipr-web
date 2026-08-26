import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  SIGNATURE_DOCUMENT_TYPES,
} from "../lib/signatures/document-classification.ts";
import {
  normalizedDisplayPointToPdf,
  normalizedRectToPdfPlacement,
} from "../lib/signatures/prototype/coordinates.ts";
import {
  MAX_DRAWN_SIGNATURE_POINTS,
  validateDrawnSignature,
  validateInitials,
  validateTypedSignature,
} from "../lib/signatures/prototype/capture.ts";
import { finalizePrototypePdf } from "../lib/signatures/prototype/finalize.ts";
import {
  canonicalJson,
  hashFieldDefinitions,
  sha256Hex,
} from "../lib/signatures/prototype/hash.ts";
import {
  inspectPdfCompatibility,
  PdfCompatibilityError,
} from "../lib/signatures/prototype/inspect.ts";
import { renderPdfWithPdfJs } from "../lib/signatures/prototype/render.ts";
import { compareRenderedPdfPages } from "../lib/signatures/prototype/visual-regression.ts";
import { fitSignatureText, signatureDateTextFits } from "../lib/signatures/text-fit.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const representativeDirectory = path.join(
  root,
  "tests/fixtures/signatures/representative"
);
const rejectionDirectory = path.join(root, "tests/fixtures/signatures/rejections");
const fontPath = path.join(
  root,
  "tests/fixtures/signatures/fonts/great-vibes/GreatVibes-Regular.ttf"
);
const representativeFiles = [
  "CONTRATO DE OPCION DE COMPRAVENTA - con logo.pdf",
  "HOJA DE OFERTA - con logo.pdf",
  "HOJA INFORMATIVA DE LOS COMPRADORES - con logo.pdf",
  "SHOWING REPORT-VENTA - con logo.pdf",
];
const limits = { maximumSourceBytes: 3_000_000, maximumPages: 25 };
const participant = {
  id: "prototype-participant",
  displayName: "Synthetic Signer",
  role: "prototype",
  completedAt: "2030-01-01T12:00:00.000Z",
};

async function fixture(directory, filename) {
  return new Uint8Array(await readFile(path.join(directory, filename)));
}

async function expectCompatibilityError(filename, code) {
  const bytes = await fixture(rejectionDirectory, filename);
  await assert.rejects(
    inspectPdfCompatibility({ bytes, mimeType: "application/pdf", limits }),
    (error) => error instanceof PdfCompatibilityError && error.code === code
  );
}

async function createGeometryPdf() {
  const document = await PDFDocument.create();
  document.setCreationDate(new Date("2030-01-01T00:00:00.000Z"));
  document.setModificationDate(new Date("2030-01-01T00:00:00.000Z"));
  const font = await document.embedFont(StandardFonts.Helvetica);
  const definitions = [
    { width: 612, height: 792, rotation: 0 },
    { width: 792, height: 612, rotation: 90 },
    { width: 500, height: 700, rotation: 180 },
    { width: 700, height: 500, rotation: 270 },
  ];
  for (const definition of definitions) {
    const page = document.addPage([definition.width, definition.height]);
    page.setCropBox(18, 24, definition.width - 36, definition.height - 48);
    page.setRotation(degrees(definition.rotation));
    page.drawText(`Rotation ${definition.rotation}`, {
      x: 42,
      y: definition.height - 70,
      size: 12,
      font,
    });
    page.drawRectangle({
      x: 38,
      y: 38,
      width: definition.width - 76,
      height: definition.height - 76,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
  }
  return new Uint8Array(
    await document.save({ useObjectStreams: false, addDefaultPage: false })
  );
}

function finalizationInput(sourceBytes, inspection, fields) {
  return {
    sourceBytes,
    sourceTitle: "Synthetic geometry fixture",
    sourceSha256: inspection.sourceSha256,
    geometries: inspection.pages,
    fields,
    participants: [participant],
    requestId: "phase2a-request",
    verificationId: "phase2a-verification",
    consentVersion: "prototype-consent-v1",
    completedAt: "2030-01-01T12:00:00.000Z",
    typedSignatureFontPath: fontPath,
  };
}

test("document catalog distinguishes ordinary brokerage scope from external formalities", () => {
  assert.ok(
    SIGNATURE_DOCUMENT_TYPES.some(
      (item) => item.scope === "formality_caution" && item.id === "deed" && item.defaultApprovalMode === "out_of_scope"
    )
  );
  assert.ok(
    SIGNATURE_DOCUMENT_TYPES.some((item) => item.id === "transaction_acknowledgment" && item.scope === "ordinary_brokerage" && item.defaultApprovalMode === "internal_business")
  );
});

test("all four representative blank templates are compatible and hash deterministically", async () => {
  for (const filename of representativeFiles) {
    const bytes = await fixture(representativeDirectory, filename);
    const first = await inspectPdfCompatibility({
      bytes,
      mimeType: "application/pdf",
      limits,
    });
    const second = await inspectPdfCompatibility({
      bytes,
      mimeType: "application/pdf",
      limits,
    });
    assert.equal(first.sourceSha256, second.sourceSha256);
    assert.equal(first.sourceSha256, sha256Hex(bytes));
    assert.equal(first.encrypted, false);
    assert.equal(first.hasXfa, false);
    assert.equal(first.embeddedFileCount, 0);
    assert.equal(first.hasJavaScript, false);
    assert.equal(first.hasUnsupportedActions, false);
    assert.equal(first.existingSignatureCount, 0);
  }
});

test("valid ordinary PDFs are accepted", async () => {
  const bytes = await fixture(rejectionDirectory, "valid-ordinary.pdf");
  const report = await inspectPdfCompatibility({
    bytes,
    mimeType: "application/pdf",
    limits,
  });
  assert.equal(report.pageCount, 1);
});

test("unsafe and unsupported PDF structures are rejected", async (context) => {
  await context.test("encrypted PDF", () =>
    expectCompatibilityError("encrypted.pdf", "encrypted_pdf")
  );
  await context.test("XFA", () =>
    expectCompatibilityError("xfa.pdf", "xfa_not_supported")
  );
  await context.test("embedded file", () =>
    expectCompatibilityError("embedded-file.pdf", "embedded_files_not_supported")
  );
  await context.test("JavaScript", () =>
    expectCompatibilityError("javascript.pdf", "javascript_not_supported")
  );
  await context.test("unsupported action", () =>
    expectCompatibilityError("unsupported-action.pdf", "actions_not_supported")
  );
  await context.test("existing digital signature", () =>
    expectCompatibilityError("existing-signature.pdf", "existing_signature_not_supported")
  );
  await context.test("malformed PDF", () =>
    expectCompatibilityError("malformed.pdf", "malformed_pdf")
  );
});

test("MIME, source-size, and page-count limits fail closed", async () => {
  const valid = await fixture(rejectionDirectory, "valid-ordinary.pdf");
  await assert.rejects(
    inspectPdfCompatibility({ bytes: valid, mimeType: "text/plain", limits }),
    (error) => error instanceof PdfCompatibilityError && error.code === "invalid_mime"
  );
  await assert.rejects(
    inspectPdfCompatibility({
      bytes: valid,
      mimeType: "application/pdf",
      limits: { ...limits, maximumSourceBytes: valid.byteLength - 1 },
    }),
    (error) => error instanceof PdfCompatibilityError && error.code === "oversized_pdf"
  );
  const document = await PDFDocument.create();
  document.addPage();
  document.addPage();
  const twoPages = new Uint8Array(await document.save());
  await assert.rejects(
    inspectPdfCompatibility({
      bytes: twoPages,
      mimeType: "application/pdf",
      limits: { ...limits, maximumPages: 1 },
    }),
    (error) =>
      error instanceof PdfCompatibilityError && error.code === "excessive_page_count"
  );
});

test("coordinate conversion matches PDF.js for all rotations, crop boxes, zoom, and sizes", async () => {
  const bytes = await createGeometryPdf();
  const inspection = await inspectPdfCompatibility({
    bytes,
    mimeType: "application/pdf",
    limits,
  });
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const document = await task.promise;
  try {
    for (const geometry of inspection.pages) {
      const page = await document.getPage(geometry.pageIndex + 1);
      for (const scale of [0.75, 1, 2.25]) {
        const viewport = page.getViewport({ scale });
        const normalized = { x: 0.27, y: 0.63 };
        const expected = viewport.convertToPdfPoint(
          normalized.x * viewport.width,
          normalized.y * viewport.height
        );
        const actual = normalizedDisplayPointToPdf(normalized, geometry);
        assert.ok(Math.abs(actual.x - expected[0]) < 0.0001);
        assert.ok(Math.abs(actual.y - expected[1]) < 0.0001);
      }
      const placement = normalizedRectToPdfPlacement(
        { x: 0.2, y: 0.25, width: 0.35, height: 0.12 },
        geometry
      );
      assert.ok(placement.bounds.width > 0);
      assert.ok(placement.bounds.height > 0);
    }
  } finally {
    await task.destroy();
  }
});

test("drawn and typed capture validation is bounded", () => {
  assert.equal(validateTypedSignature("Synthetic Signer"), "Synthetic Signer");
  assert.equal(validateInitials("SS"), "SS");
  const valid = validateDrawnSignature([
    [
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    ],
  ]);
  assert.equal(valid.pointCount, 2);
  const excessive = Array.from({ length: MAX_DRAWN_SIGNATURE_POINTS + 1 }, (_, index) => ({
    x: index / MAX_DRAWN_SIGNATURE_POINTS,
    y: 0.5,
  }));
  assert.throws(() => validateDrawnSignature([excessive]));
});

test("field-definition hash is deterministic and independent of values/order", () => {
  const left = [
    {
      id: "b",
      participantId: "p",
      type: "text",
      pageIndex: 0,
      rect: { x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
      value: { method: "text", value: "first" },
    },
    {
      id: "a",
      participantId: "p",
      type: "signature",
      pageIndex: 1,
      rect: { x: 0.2, y: 0.3, width: 0.4, height: 0.2 },
      value: { method: "typed", value: "Signer" },
    },
  ];
  const right = [
    { ...left[1], value: { method: "typed", value: "Changed" } },
    { ...left[0], value: { method: "text", value: "Changed" } },
  ];
  assert.equal(hashFieldDefinitions(left), hashFieldDefinitions(right));
  assert.equal(canonicalJson({ b: 2, a: 1 }), '{"a":1,"b":2}');
});

test("finalization is deterministic, preserves the source page count, and emits no production-visible prototype chrome", async () => {
  const sourceBytes = await createGeometryPdf();
  const sourceSnapshot = new Uint8Array(sourceBytes);
  const inspection = await inspectPdfCompatibility({
    bytes: sourceBytes,
    mimeType: "application/pdf",
    limits,
  });
  const fields = inspection.pages.map((page) => ({
    id: `field-${page.rotation}`,
    participantId: participant.id,
    type: "signature",
    pageIndex: page.pageIndex,
    rect: { x: 0.2, y: 0.25, width: 0.35, height: 0.12 },
    value: { method: "typed", value: `Signer ${page.rotation}` },
  }));
  const input = finalizationInput(sourceBytes, inspection, fields);
  const first = await finalizePrototypePdf(input);
  const second = await finalizePrototypePdf(input);
  assert.deepEqual(first.finalBytes, second.finalBytes);
  assert.deepEqual(sourceBytes, sourceSnapshot);
  assert.notEqual(first.manifest.finalPdfSha256, inspection.sourceSha256);
  assert.equal(first.manifest.sourceSha256, inspection.sourceSha256);
  assert.equal(first.manifest.schemaVersion, "boriki-sign-final-v1");
  assert.equal(first.manifest.certificate.appended, false);
  assert.equal(first.manifest.fieldCaptures.length, 4);
  assert.deepEqual(
    first.manifest.fieldCaptures.map(({ captureMethod, adoptedValue }) => ({
      captureMethod,
      adoptedValue,
    })),
    [
      { captureMethod: "typed", adoptedValue: "Signer 0" },
      { captureMethod: "typed", adoptedValue: "Signer 180" },
      { captureMethod: "typed", adoptedValue: "Signer 270" },
      { captureMethod: "typed", adoptedValue: "Signer 90" },
    ]
  );
  assert.ok(
    first.manifest.fieldCaptures.every(({ captureSha256 }) =>
      /^[a-f0-9]{64}$/.test(captureSha256)
    )
  );
  const finalizedDocument = await PDFDocument.load(first.finalBytes);
  assert.equal(finalizedDocument.getPageCount(), inspection.pageCount);
  assert.equal(finalizedDocument.getTitle(), `${input.sourceTitle} — completado`);
  assert.equal(finalizedDocument.getAuthor(), "Borikí Sign");

  const [sourcePages, finalPages] = await Promise.all([
    renderPdfWithPdfJs(sourceBytes, 1.2),
    renderPdfWithPdfJs(first.finalBytes, 1.2),
  ]);
  for (const page of inspection.pages) {
    const visual = compareRenderedPdfPages({
      source: sourcePages[page.pageIndex],
      finalized: finalPages[page.pageIndex],
      expectedRegions: [fields[page.pageIndex].rect],
    });
    assert.ok(visual.changedPixelsInsideExpectedRegions > 0);
    assert.equal(visual.changedPixelsOutsideExpectedRegions, 0);
  }
});

test("Date Signed fitting predicts and renders the final text inside its field bounds", async () => {
  const normal = signatureDateTextFits({ widthPoints: 183.6, heightPoints: 55.44 });
  const narrow = signatureDateTextFits({ widthPoints: 50, heightPoints: 24 });
  const impossible = signatureDateTextFits({ widthPoints: 24, heightPoints: 12 });
  assert.equal(normal.fits, true);
  assert.equal(normal.fontSize, 10);
  assert.equal(narrow.fits, true);
  assert.ok(narrow.fontSize < normal.fontSize);
  assert.equal(impossible.fits, false);

  const exact = fitSignatureText({
    value: "2026-08-25",
    availableWidth: 54,
    availableHeight: 12,
    preferredFontSize: 10,
    widthAtSize: (value, size) => value.length * size * 0.5,
    heightAtSize: (size) => size,
  });
  assert.equal(exact.fits, true);
  assert.ok(exact.width <= 54);
  assert.ok(exact.height <= 12);

  const sourceBytes = await fixture(representativeDirectory, "HOJA DE OFERTA - con logo.pdf");
  const inspection = await inspectPdfCompatibility({ bytes: sourceBytes, mimeType: "application/pdf", limits });
  const dateField = {
    id: "canary-0038-date-signed",
    participantId: participant.id,
    type: "date_signed",
    pageIndex: 0,
    // Exact geometry captured from the immutable 0038 production canary.
    rect: { x: 0.42, y: 0.62, width: 0.30, height: 0.07 },
    value: { method: "date", value: "2026-08-25" },
  };
  const finalized = await finalizePrototypePdf(finalizationInput(sourceBytes, inspection, [dateField]));
  const finalizedDocument = await PDFDocument.load(finalized.finalBytes);
  assert.equal(finalizedDocument.getPageCount(), 1);
  const [sourcePage] = await renderPdfWithPdfJs(sourceBytes, 1.5);
  const [finalPage] = await renderPdfWithPdfJs(finalized.finalBytes, 1.5);
  const visual = compareRenderedPdfPages({ source: sourcePage, finalized: finalPage, expectedRegions: [dateField.rect] });
  assert.ok(visual.changedPixelsInsideExpectedRegions > 0);
  assert.equal(visual.changedPixelsOutsideExpectedRegions, 0);

  await assert.rejects(
    finalizePrototypePdf(finalizationInput(sourceBytes, inspection, [{
      ...dateField,
      id: "impossible-date-signed",
      rect: { x: 0.42, y: 0.62, width: 0.025, height: 0.015 },
    }])),
    /signature_field_text_does_not_fit/,
  );
});

test("prototype code has no production storage, database, email, network, or logging coupling", async () => {
  const prototypeDirectory = path.join(root, "lib/signatures/prototype");
  const sourceFiles = (await readdir(prototypeDirectory)).filter((name) => name.endsWith(".ts"));
  for (const filename of sourceFiles) {
    const source = await readFile(path.join(prototypeDirectory, filename), "utf8");
    assert.doesNotMatch(source, /@\/lib\/(?:r2|db|email)|\bResend\b|process\.env|console\./);
  }

  const marker = "Synthetic Phase 2A fixture";
  const valid = await fixture(rejectionDirectory, "valid-ordinary.pdf");
  const messages = [];
  const originals = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    fetch: globalThis.fetch,
  };
  console.log = (...values) => messages.push(values.join(" "));
  console.warn = (...values) => messages.push(values.join(" "));
  console.error = (...values) => messages.push(values.join(" "));
  globalThis.fetch = async () => {
    throw new Error("Network access is forbidden in the PDF prototype test.");
  };
  try {
    await inspectPdfCompatibility({ bytes: valid, mimeType: "application/pdf", limits });
  } finally {
    console.log = originals.log;
    console.warn = originals.warn;
    console.error = originals.error;
    globalThis.fetch = originals.fetch;
  }
  assert.equal(messages.some((message) => message.includes(marker)), false);
});
