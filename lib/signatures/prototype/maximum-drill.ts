import path from "node:path";
import { degrees, PDFDocument, StandardFonts } from "pdf-lib";
import { finalizePrototypePdf } from "./finalize";
import { sha256Hex } from "./hash";
import type { PdfPageGeometry, PrototypeField, PrototypeParticipant } from "./types";

const COMPLETED_AT = "2032-06-01T12:00:00.000Z";

export async function runSyntheticMaximumPdfDrill() {
  const source = await PDFDocument.create();
  source.setCreationDate(new Date("2030-01-01T00:00:00.000Z"));
  source.setModificationDate(new Date("2030-01-01T00:00:00.000Z"));
  const font = await source.embedFont(StandardFonts.Helvetica);
  const geometries: PdfPageGeometry[] = [];
  for (let pageIndex = 0; pageIndex < 25; pageIndex += 1) {
    const width = pageIndex % 2 === 0 ? 612 : 595;
    const height = pageIndex % 2 === 0 ? 792 : 842;
    const rotation = (pageIndex % 4 * 90) as 0 | 90 | 180 | 270;
    const page = source.addPage([width, height]);
    page.setRotation(degrees(rotation));
    page.drawText(`Synthetic signing drill page ${pageIndex + 1}`, { x: 36, y: height - 48, size: 12, font });
    geometries.push({
      pageIndex,
      mediaBox: { x: 0, y: 0, width, height },
      cropBox: { x: 0, y: 0, width, height },
      rotation,
      userUnit: 1,
    });
  }
  const sourceBytes = new Uint8Array(await source.save({ useObjectStreams: false }));
  const participants: PrototypeParticipant[] = Array.from({ length: 8 }, (_, index) => ({
    id: `synthetic-participant-${index + 1}`,
    displayName: `Synthetic Participant ${index + 1}`,
    role: index % 2 === 0 ? "buyer" : "seller",
    completedAt: COMPLETED_AT,
  }));
  const methods = ["signature", "initials", "date", "text"] as const;
  const fields: PrototypeField[] = Array.from({ length: 100 }, (_, index) => {
    const type = methods[index % methods.length];
    const value = type === "signature"
      ? (index % 8 === 0
          ? { method: "drawn" as const, strokes: [[{ x: 0.08, y: 0.65 }, { x: 0.35, y: 0.25 }, { x: 0.62, y: 0.7 }, { x: 0.92, y: 0.3 }]] }
          : { method: "typed" as const, value: `Synthetic Signer ${index + 1}` })
      : type === "initials"
        ? { method: "typed" as const, value: `S${index % 8 + 1}` }
        : type === "date"
          ? { method: "date" as const, value: "2032-06-01" }
          : { method: "text" as const, value: `Synthetic bounded text ${index + 1}` };
    return {
      id: `field-${String(index + 1).padStart(3, "0")}`,
      participantId: participants[index % participants.length].id,
      type,
      pageIndex: index % 25,
      rect: {
        x: 0.06 + (index % 2) * 0.46,
        y: 0.16 + (Math.floor(index / 2) % 4) * 0.18,
        width: 0.38,
        height: 0.09,
      },
      value,
    } satisfies PrototypeField;
  });
  const beforeHeap = process.memoryUsage().heapUsed;
  const started = performance.now();
  const finalized = await finalizePrototypePdf({
    sourceBytes,
    sourceTitle: "Synthetic maximum signing drill",
    sourceSha256: sha256Hex(sourceBytes),
    geometries,
    fields,
    participants,
    requestId: "synthetic-maximum-drill",
    verificationId: "synthetic-maximum-drill-verification",
    consentVersion: "synthetic-not-legally-approved",
    completedAt: COMPLETED_AT,
    typedSignatureFontPath: path.join(process.cwd(), "tests/fixtures/signatures/fonts/great-vibes/GreatVibes-Regular.ttf"),
  });
  return {
    sourceBytes,
    finalBytes: finalized.finalBytes,
    manifest: finalized.manifest,
    metrics: Object.freeze({
      pages: 25,
      participants: 8,
      fields: 100,
      sourceBytes: sourceBytes.byteLength,
      finalBytes: finalized.finalBytes.byteLength,
      finalizationMs: Math.round(performance.now() - started),
      heapDeltaBytes: Math.max(0, process.memoryUsage().heapUsed - beforeHeap),
    }),
  };
}
