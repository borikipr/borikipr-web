import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { HOJA_DE_OFERTA_BROKER_FINAL_FIELD } from "../../lib/signatures/offer-template-geometry";
import { finalizePrototypePdf } from "../../lib/signatures/prototype/finalize";
import { inspectPdfCompatibility } from "../../lib/signatures/prototype/inspect";
import { renderPdfWithPdfJs } from "../../lib/signatures/prototype/render";

const HISTORICAL_MANUAL_BROKER_FIELD = Object.freeze({
  x: 0.541061461,
  y: 0.77,
  width: 0.3,
  height: 0.07,
});

async function main() {
  const root = process.cwd();
  const sourceBytes = new Uint8Array(
    await readFile(
      path.join(
        root,
        "tests/fixtures/signatures/representative/HOJA DE OFERTA - con logo.pdf",
      ),
    ),
  );
  const inspection = await inspectPdfCompatibility({
    bytes: sourceBytes,
    mimeType: "application/pdf",
    limits: { maximumSourceBytes: 3_000_000, maximumPages: 25 },
  });
  const participants = [
    {
      id: "synthetic-buyer",
      displayName: "Cedric Santiago",
      role: "Comprador 1",
      completedAt: "2030-01-01T12:00:00.000Z",
    },
    {
      id: "synthetic-broker",
      displayName: "Ivonne Erickson",
      role: "Corredora · Firma final",
      completedAt: "2030-01-01T12:02:00.000Z",
    },
  ];
  const commonFields = [
    { id: "cash", participantId: "synthetic-buyer", type: "checkbox", pageIndex: 0, rect: { x: 0.66, y: 0.36, width: 0.04, height: 0.04 }, value: { method: "checkbox", value: true } },
    { id: "terms", participantId: "synthetic-buyer", type: "text", pageIndex: 0, rect: { x: 0.18, y: 0.46, width: 0.3, height: 0.07 }, value: { method: "text", value: "PRUEBA SINTÉTICA" } },
    { id: "date", participantId: "synthetic-buyer", type: "date_signed", pageIndex: 0, rect: { x: 0.45, y: 0.58, width: 0.3, height: 0.07 }, value: { method: "date", value: "2030-01-01" } },
    { id: "buyer-signature", participantId: "synthetic-buyer", type: "signature", pageIndex: 0, rect: { x: 0.1, y: 0.68, width: 0.3, height: 0.07 }, value: { method: "typed", value: "Cedric Santiago" } },
    { id: "initials", participantId: "synthetic-buyer", type: "initials", pageIndex: 0, rect: { x: 0.07, y: 0.92, width: 0.18, height: 0.07 }, value: { method: "typed", value: "CS" } },
  ] as const;
  const finalize = (brokerRect: typeof HOJA_DE_OFERTA_BROKER_FINAL_FIELD) =>
    finalizePrototypePdf({
      sourceBytes,
      sourceTitle: "Hoja de Oferta - verificación aislada",
      sourceSha256: inspection.sourceSha256,
      geometries: inspection.pages,
      fields: [
        ...commonFields,
        { id: "broker-final", participantId: "synthetic-broker", type: "signature", pageIndex: 0, rect: brokerRect, value: { method: "typed", value: "Ivonne Erickson" } },
      ],
      participants,
      requestId: "isolated-ivonne-field-position",
      verificationId: "isolated-ivonne-field-position-verification",
      consentVersion: "isolated-es-pr",
      completedAt: "2030-01-01T12:02:00.000Z",
      typedSignatureFontPath: path.join(
        root,
        "tests/fixtures/signatures/fonts/great-vibes/GreatVibes-Regular.ttf",
      ),
    });
  const [before, after] = await Promise.all([
    finalize(HISTORICAL_MANUAL_BROKER_FIELD),
    finalize(HOJA_DE_OFERTA_BROKER_FINAL_FIELD),
  ]);
  const [beforePages, afterPages] = await Promise.all([
    renderPdfWithPdfJs(before.finalBytes, 2),
    renderPdfWithPdfJs(after.finalBytes, 2),
  ]);
  if (beforePages.length !== 1 || afterPages.length !== 1) {
    throw new Error("ivonne_field_fixture_page_count_invalid");
  }
  const outputDirectory = path.join(root, "output", "pdf");
  const qaDirectory = path.join(root, "tmp", "pdfs", "ivonne-field-position");
  await Promise.all([
    mkdir(outputDirectory, { recursive: true }),
    mkdir(qaDirectory, { recursive: true }),
  ]);
  const outputPdf = path.join(outputDirectory, "ivonne-field-position-corrected.pdf");
  await Promise.all([
    writeFile(outputPdf, after.finalBytes),
    writeFile(path.join(qaDirectory, "before-manual-placement.png"), beforePages[0].pngBytes),
    writeFile(path.join(qaDirectory, "after-template-placement.png"), afterPages[0].pngBytes),
  ]);
  console.log(JSON.stringify({ outputPdf, qaDirectory }));
}

void main();
