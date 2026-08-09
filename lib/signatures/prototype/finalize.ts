import { readFile } from "node:fs/promises";
import { degrees, PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { drawPrototypeCertificatePage } from "./certificate";
import {
  fieldPointToPagePoint,
  normalizedRectToPdfPlacement,
} from "./coordinates";
import {
  validateBoundedText,
  validateDrawnSignature,
  validateInitials,
  validateTypedSignature,
} from "./capture";
import { canonicalJson, hashFieldDefinitions, sha256Hex } from "./hash";
import type {
  PdfPageGeometry,
  PrototypeEvidenceManifest,
  PrototypeField,
  PrototypeParticipant,
} from "./types";

const FIXED_METADATA_DATE = new Date("2030-01-01T00:00:00.000Z");

function displayDimensions(geometry: PdfPageGeometry, bounds: { width: number; height: number }) {
  return geometry.rotation === 90 || geometry.rotation === 270
    ? { width: bounds.height, height: bounds.width }
    : { width: bounds.width, height: bounds.height };
}

function textOrigin(
  geometry: PdfPageGeometry,
  bounds: { x: number; y: number; width: number; height: number },
  padding: number
) {
  switch (geometry.rotation) {
    case 0:
      return { x: bounds.x + padding, y: bounds.y + padding };
    case 90:
      return { x: bounds.x + bounds.width - padding, y: bounds.y + padding };
    case 180:
      return { x: bounds.x + bounds.width - padding, y: bounds.y + bounds.height - padding };
    case 270:
      return { x: bounds.x + padding, y: bounds.y + bounds.height - padding };
  }
}

function fitFontSize(font: PDFFont, value: string, width: number, height: number) {
  let size = Math.max(6, Math.min(26, height * 0.62));
  const measured = font.widthOfTextAtSize(value, size);
  if (measured > width) size = Math.max(6, (size * width) / measured);
  return size;
}

function drawTextValue({
  page,
  geometry,
  bounds,
  font,
  value,
}: {
  page: PDFPage;
  geometry: PdfPageGeometry;
  bounds: { x: number; y: number; width: number; height: number };
  font: PDFFont;
  value: string;
}) {
  const dimensions = displayDimensions(geometry, bounds);
  const padding = Math.min(4, dimensions.height * 0.12);
  const size = fitFontSize(
    font,
    value,
    Math.max(1, dimensions.width - padding * 2),
    Math.max(1, dimensions.height - padding * 2)
  );
  page.drawText(value, {
    ...textOrigin(geometry, bounds, padding),
    size,
    font,
    rotate: degrees(geometry.rotation),
    color: rgb(0.05, 0.12, 0.25),
  });
}

function drawField({
  page,
  geometry,
  field,
  typedFont,
  bodyFont,
}: {
  page: PDFPage;
  geometry: PdfPageGeometry;
  field: PrototypeField;
  typedFont: PDFFont;
  bodyFont: PDFFont;
}) {
  const placement = normalizedRectToPdfPlacement(field.rect, geometry);
  page.drawRectangle({
    ...placement.bounds,
    borderColor: rgb(0.12, 0.32, 0.62),
    borderWidth: 0.75,
    color: rgb(0.94, 0.97, 1),
    opacity: 0.16,
  });

  if (field.value.method === "drawn") {
    validateDrawnSignature(field.value.strokes);
    for (const stroke of field.value.strokes) {
      for (let index = 1; index < stroke.length; index += 1) {
        page.drawLine({
          start: fieldPointToPagePoint(field.rect, stroke[index - 1], geometry),
          end: fieldPointToPagePoint(field.rect, stroke[index], geometry),
          thickness: 1.4,
          color: rgb(0.03, 0.08, 0.18),
        });
      }
    }
    return;
  }

  let value: string;
  let font = bodyFont;
  if (field.value.method === "typed") {
    value = field.type === "initials"
      ? validateInitials(field.value.value)
      : validateTypedSignature(field.value.value);
    font = typedFont;
  } else if (field.value.method === "date") {
    value = validateBoundedText(field.value.value);
  } else {
    value = validateBoundedText(field.value.value);
  }
  drawTextValue({ page, geometry, bounds: placement.bounds, font, value });
}

export async function finalizePrototypePdf({
  sourceBytes,
  sourceTitle,
  sourceSha256,
  geometries,
  fields,
  participants,
  requestId,
  verificationId,
  consentVersion,
  completedAt,
  typedSignatureFontPath,
}: {
  sourceBytes: Uint8Array;
  sourceTitle: string;
  sourceSha256: string;
  geometries: readonly PdfPageGeometry[];
  fields: readonly PrototypeField[];
  participants: readonly PrototypeParticipant[];
  requestId: string;
  verificationId: string;
  consentVersion: string;
  completedAt: string;
  typedSignatureFontPath: string;
}): Promise<{
  finalBytes: Uint8Array;
  fieldDefinitionSha256: string;
  manifest: PrototypeEvidenceManifest;
}> {
  if (sha256Hex(sourceBytes) !== sourceSha256) {
    throw new Error("Source PDF hash changed before finalization.");
  }
  const document = await PDFDocument.load(new Uint8Array(sourceBytes), {
    ignoreEncryption: false,
    updateMetadata: false,
  });
  document.registerFontkit(fontkit);
  document.setTitle(`${sourceTitle} - Phase 2A prototype`);
  document.setAuthor("BorikiPR Phase 2A prototype");
  document.setCreator("BorikiPR Phase 2A prototype");
  document.setProducer("pdf-lib 1.17.1");
  document.setCreationDate(FIXED_METADATA_DATE);
  document.setModificationDate(FIXED_METADATA_DATE);
  const bodyFont = await document.embedFont(StandardFonts.Helvetica);
  const boldFont = await document.embedFont(StandardFonts.HelveticaBold);
  const typedFontBytes = await readFile(typedSignatureFontPath);
  const typedFont = await document.embedFont(typedFontBytes, { subset: true });
  const pages = document.getPages();

  for (const field of [...fields].sort((left, right) => left.id.localeCompare(right.id))) {
    const geometry = geometries[field.pageIndex];
    const page = pages[field.pageIndex];
    if (!geometry || !page) throw new Error("Field references a page that does not exist.");
    if (!participants.some((participant) => participant.id === field.participantId)) {
      throw new Error("Field references an unknown participant.");
    }
    drawField({ page, geometry, field, typedFont, bodyFont });
  }

  const certificatePage = document.addPage([612, 792]);
  drawPrototypeCertificatePage({
    page: certificatePage,
    font: bodyFont,
    boldFont,
    input: {
      requestId,
      documentTitle: sourceTitle,
      participants,
      consentVersion,
      sourceSha256,
      verificationId,
      completedAt,
    },
  });
  const finalBytes = await document.save({
    addDefaultPage: false,
    objectsPerTick: 50,
    useObjectStreams: false,
    updateFieldAppearances: false,
  });
  const fieldDefinitionSha256 = hashFieldDefinitions(fields);
  const finalPdfSha256 = sha256Hex(finalBytes);
  const manifest: PrototypeEvidenceManifest = {
    schemaVersion: "phase2a-prototype-v1",
    requestId,
    verificationId,
    sourceSha256,
    finalPdfSha256,
    fieldDefinitionSha256,
    certificate: { appended: true, consentVersion, completedAt },
    participants: participants.map(({ id, role, completedAt: participantCompletedAt }) => ({
      id,
      role,
      completedAt: participantCompletedAt,
    })),
    fieldCaptures: [...fields]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((field) => ({
        fieldId: field.id,
        participantId: field.participantId,
        fieldType: field.type,
        captureMethod: field.value.method,
        ...(field.value.method === "typed"
          ? { adoptedValue: field.value.value }
          : {}),
        captureSha256: sha256Hex(canonicalJson(field.value)),
      })),
    eventPlaceholders: [
      "consent_accepted",
      "field_completed",
      "participant_completed",
      "document_completed",
    ],
  };
  return { finalBytes, fieldDefinitionSha256, manifest };
}
