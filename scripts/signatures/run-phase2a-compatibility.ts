import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { finalizePrototypePdf } from "../../lib/signatures/prototype/finalize";
import { inspectPdfCompatibility } from "../../lib/signatures/prototype/inspect";
import { renderPdfWithPdfJs } from "../../lib/signatures/prototype/render";
import type {
  NormalizedRect,
  PrototypeField,
  PrototypeParticipant,
} from "../../lib/signatures/prototype/types";
import { compareRenderedPdfPages } from "../../lib/signatures/prototype/visual-regression";
import { canonicalJson, sha256Hex } from "../../lib/signatures/prototype/hash";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const fixtureDirectory = path.join(
  repositoryRoot,
  "tests/fixtures/signatures/representative"
);
const outputDirectory = path.join(repositoryRoot, "tmp/pdfs/phase2a-compatibility");
const fontPath = path.join(
  repositoryRoot,
  "tests/fixtures/signatures/fonts/great-vibes/GreatVibes-Regular.ttf"
);
const files = [
  "CONTRATO DE OPCION DE COMPRAVENTA - con logo.pdf",
  "HOJA DE OFERTA - con logo.pdf",
  "HOJA INFORMATIVA DE LOS COMPRADORES - con logo.pdf",
  "SHOWING REPORT-VENTA - con logo.pdf",
];
const limits = { maximumSourceBytes: 3_000_000, maximumPages: 25 } as const;
const participant: PrototypeParticipant = {
  id: "participant-prototype-1",
  displayName: "Persona de Prueba",
  role: "prototype_signer",
  completedAt: "2030-01-01T12:00:00.000Z",
};

const fieldRects: readonly NormalizedRect[] = [
  { x: 0.08, y: 0.78, width: 0.32, height: 0.055 },
  { x: 0.43, y: 0.78, width: 0.12, height: 0.055 },
  { x: 0.58, y: 0.78, width: 0.2, height: 0.055 },
  { x: 0.08, y: 0.86, width: 0.7, height: 0.045 },
];

function fieldsForPage(pageIndex: number): readonly PrototypeField[] {
  return [
    {
      id: "signature",
      participantId: participant.id,
      type: "signature",
      pageIndex,
      rect: fieldRects[0],
      value: {
        method: "drawn",
        strokes: [
          [
            { x: 0.05, y: 0.7 },
            { x: 0.25, y: 0.25 },
            { x: 0.48, y: 0.72 },
            { x: 0.72, y: 0.2 },
            { x: 0.95, y: 0.55 },
          ],
        ],
      },
    },
    {
      id: "initials",
      participantId: participant.id,
      type: "initials",
      pageIndex,
      rect: fieldRects[1],
      value: { method: "typed", value: "PP" },
    },
    {
      id: "date",
      participantId: participant.id,
      type: "date",
      pageIndex,
      rect: fieldRects[2],
      value: { method: "date", value: "2030-01-01" },
    },
    {
      id: "bounded-text",
      participantId: participant.id,
      type: "text",
      pageIndex,
      rect: fieldRects[3],
      value: { method: "text", value: "Texto de prueba" },
    },
  ];
}

async function main() {
  await mkdir(outputDirectory, { recursive: true });
  const reports = [];
  for (let index = 0; index < files.length; index += 1) {
  const filename = files[index];
  const sourcePath = path.join(fixtureDirectory, filename);
  const sourceBytes = new Uint8Array(await readFile(sourcePath));
  const sourceBefore = sha256Hex(sourceBytes);
  const inspection = await inspectPdfCompatibility({
    bytes: sourceBytes,
    mimeType: "application/pdf",
    limits,
  });
  const pageIndex = inspection.pageCount - 1;
  const fields = fieldsForPage(pageIndex);
  const finalized = await finalizePrototypePdf({
    sourceBytes,
    sourceTitle: `Representative PDF ${index + 1}`,
    sourceSha256: inspection.sourceSha256,
    geometries: inspection.pages,
    fields,
    participants: [participant],
    requestId: `phase2a-request-${index + 1}`,
    verificationId: `phase2a-verification-${index + 1}`,
    consentVersion: "prototype-consent-v1",
    completedAt: "2030-01-01T12:00:00.000Z",
    typedSignatureFontPath: fontPath,
  });
  const safeStem = `representative-${index + 1}`;
  await writeFile(path.join(outputDirectory, `${safeStem}-final.pdf`), finalized.finalBytes);
  await writeFile(
    path.join(outputDirectory, `${safeStem}-manifest.json`),
    `${canonicalJson(finalized.manifest)}\n`,
    "utf8"
  );
  const [sourceRenders, finalRenders] = await Promise.all([
    renderPdfWithPdfJs(sourceBytes),
    renderPdfWithPdfJs(finalized.finalBytes),
  ]);
  for (const rendered of sourceRenders) {
    await writeFile(
      path.join(outputDirectory, `${safeStem}-source-page-${rendered.pageIndex + 1}.png`),
      rendered.pngBytes
    );
  }
  for (const rendered of finalRenders) {
    await writeFile(
      path.join(outputDirectory, `${safeStem}-final-page-${rendered.pageIndex + 1}.png`),
      rendered.pngBytes
    );
  }
  const pageVisuals = sourceRenders.map((sourceRender, sourcePageIndex) =>
    compareRenderedPdfPages({
      source: sourceRender,
      finalized: finalRenders[sourcePageIndex],
      expectedRegions: sourcePageIndex === pageIndex ? fieldRects : [],
    })
  );
  const sourceAfter = sha256Hex(new Uint8Array(await readFile(sourcePath)));
    reports.push({
    filename,
    inspection,
    finalByteSize: finalized.finalBytes.byteLength,
    finalPdfSha256: finalized.manifest.finalPdfSha256,
    fieldDefinitionSha256: finalized.fieldDefinitionSha256,
    sourceUnchanged: sourceBefore === sourceAfter,
    pageVisuals,
    certificatePageCount: finalRenders.length - sourceRenders.length,
    });
  }
  console.log(JSON.stringify({ limits, reports }, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown prototype failure.";
  process.stderr.write(`Phase 2A compatibility prototype failed: ${message}\n`);
  process.exitCode = 1;
});
