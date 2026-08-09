import type { PdfCompatibilityLimits, PdfCompatibilityReport } from "./types";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeRotation } from "./coordinates";
import { sha256Hex } from "./hash";

export type PdfCompatibilityErrorCode =
  | "invalid_mime"
  | "oversized_pdf"
  | "malformed_pdf"
  | "encrypted_pdf"
  | "excessive_page_count"
  | "xfa_not_supported"
  | "embedded_files_not_supported"
  | "javascript_not_supported"
  | "actions_not_supported"
  | "existing_signature_not_supported";

export class PdfCompatibilityError extends Error {
  constructor(
    public readonly code: PdfCompatibilityErrorCode,
    message: string
  ) {
    super(message);
    this.name = "PdfCompatibilityError";
  }
}

const PDF_HEADER = /^%PDF-(\d\.\d)/;
const RAW_XFA = /\/XFA\b/;
const RAW_EMBEDDED_FILES = /\/EmbeddedFiles\b|\/Filespec\b/;
const RAW_JAVASCRIPT = /\/JavaScript\b|\/JS\b/;
const RAW_UNSUPPORTED_ACTION = /\/(?:Launch|SubmitForm|ImportData|GoToR)\b/;
const RAW_SIGNATURE = /\/FT\s*\/Sig\b|\/ByteRange\s*\[/;

function hasOwnData(value: unknown) {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (value instanceof Map) return value.size > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function pageAnnotationHasUnsupportedAction(annotation: unknown) {
  const record = asRecord(annotation);
  return Boolean(
    record.action ||
      record.actions ||
      record.unsafeUrl ||
      record.attachment ||
      record.setOCGState
  );
}

function pageAnnotationIsSignature(annotation: unknown) {
  const record = asRecord(annotation);
  return String(record.fieldType ?? "").toLowerCase() === "sig";
}

export async function inspectPdfCompatibility({
  bytes,
  mimeType,
  limits,
}: {
  bytes: Uint8Array;
  mimeType: string;
  limits: PdfCompatibilityLimits;
}): Promise<PdfCompatibilityReport> {
  if (mimeType.toLowerCase().split(";", 1)[0].trim() !== "application/pdf") {
    throw new PdfCompatibilityError("invalid_mime", "Only application/pdf is accepted.");
  }
  if (bytes.byteLength === 0 || bytes.byteLength > limits.maximumSourceBytes) {
    throw new PdfCompatibilityError(
      "oversized_pdf",
      "PDF source size is outside the configured limit."
    );
  }

  const headerText = new TextDecoder("latin1").decode(bytes.subarray(0, 16));
  const header = PDF_HEADER.exec(headerText);
  if (!header) {
    throw new PdfCompatibilityError("malformed_pdf", "PDF header is missing or invalid.");
  }
  const rawText = new TextDecoder("latin1").decode(bytes);
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    path.resolve(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
  ).href;
  const standardFontDataUrl = `${path
    .resolve(process.cwd(), "node_modules/pdfjs-dist/standard_fonts")
    .replaceAll("\\", "/")}/`;
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    disableFontFace: true,
    standardFontDataUrl,
    useSystemFonts: false,
  });

  let pdf: Awaited<typeof loadingTask.promise> | null = null;
  try {
    pdf = await loadingTask.promise;
    if (pdf.numPages > limits.maximumPages) {
      throw new PdfCompatibilityError(
        "excessive_page_count",
        "PDF page count exceeds the configured limit."
      );
    }

    const [metadata, attachments, documentJsActions, openAction, fields, signatures] =
      await Promise.all([
        pdf.getMetadata(),
        pdf.getAttachments(),
        pdf.getJSActions(),
        pdf.getOpenAction(),
        pdf.getFieldObjects(),
        pdf.getSignatures(),
      ]);
    const info = asRecord(metadata.info);
    const embeddedFileCount = attachments?.size ?? 0;
    const hasXfa = Boolean(pdf.isPureXfa || info.IsXFAPresent || RAW_XFA.test(rawText));
    const hasAcroForm = Boolean(info.IsAcroFormPresent || fields);
    const hasJavaScript = Boolean(
      hasOwnData(documentJsActions) || RAW_JAVASCRIPT.test(rawText)
    );
    let hasUnsupportedActions = Boolean(
      hasOwnData(openAction) || RAW_UNSUPPORTED_ACTION.test(rawText)
    );
    let existingSignatureCount = signatures?.length ?? 0;
    const fontFamilies = new Set<string>();

    const pdfLib = await import("pdf-lib");
    const pdfLibDocument = await pdfLib.PDFDocument.load(new Uint8Array(bytes), {
      ignoreEncryption: false,
      updateMetadata: false,
    });
    const pdfLibPages = pdfLibDocument.getPages();
    const pages = [];

    for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
      const page = await pdf.getPage(pageIndex + 1);
      const [annotations, pageJsActions, textContent] = await Promise.all([
        page.getAnnotations({ intent: "display" }),
        page.getJSActions(),
        page.getTextContent(),
      ]);
      if (hasOwnData(pageJsActions)) hasUnsupportedActions = true;
      for (const annotation of annotations) {
        if (pageAnnotationHasUnsupportedAction(annotation)) hasUnsupportedActions = true;
        if (pageAnnotationIsSignature(annotation)) existingSignatureCount += 1;
      }
      for (const style of Object.values(textContent.styles)) {
        if (style.fontFamily?.trim()) fontFamilies.add(style.fontFamily.trim());
      }
      const pdfLibPage = pdfLibPages[pageIndex];
      const mediaBox = pdfLibPage.getMediaBox();
      const cropBox = pdfLibPage.getCropBox();
      pages.push({
        pageIndex,
        mediaBox,
        cropBox,
        rotation: normalizeRotation(pdfLibPage.getRotation().angle),
        userUnit: page.userUnit,
      });
    }

    if (hasXfa) {
      throw new PdfCompatibilityError("xfa_not_supported", "XFA PDFs are not supported.");
    }
    if (embeddedFileCount > 0 || RAW_EMBEDDED_FILES.test(rawText)) {
      throw new PdfCompatibilityError(
        "embedded_files_not_supported",
        "PDF embedded files are not supported."
      );
    }
    if (hasJavaScript) {
      throw new PdfCompatibilityError(
        "javascript_not_supported",
        "PDF JavaScript is not supported."
      );
    }
    if (hasUnsupportedActions) {
      throw new PdfCompatibilityError(
        "actions_not_supported",
        "PDF actions are not supported."
      );
    }
    if (existingSignatureCount > 0 || RAW_SIGNATURE.test(rawText)) {
      throw new PdfCompatibilityError(
        "existing_signature_not_supported",
        "PDFs with existing digital signatures are not supported."
      );
    }

    return {
      sourceSha256: sha256Hex(bytes),
      byteSize: bytes.byteLength,
      pdfVersion: String(info.PDFFormatVersion ?? header[1] ?? "") || null,
      pageCount: pdf.numPages,
      encrypted: false,
      hasAcroForm,
      hasXfa: false,
      embeddedFileCount: 0,
      hasJavaScript: false,
      hasUnsupportedActions: false,
      existingSignatureCount: 0,
      fontFamilies: [...fontFamilies].sort(),
      metadataKeys: [
        ...new Set([
          ...Object.keys(asRecord(metadata.info)),
          ...(metadata.metadata
            ? [...metadata.metadata].map(([key]) => String(key))
            : []),
        ]),
      ].sort(),
      pages,
    };
  } catch (error) {
    if (error instanceof PdfCompatibilityError) throw error;
    const details = asRecord(error);
    if (
      String(details.name ?? "").includes("PasswordException") ||
      String(details.message ?? "").toLowerCase().includes("password") ||
      String(details.message ?? "").toLowerCase().includes("encrypted")
    ) {
      throw new PdfCompatibilityError("encrypted_pdf", "Encrypted PDFs are not supported.");
    }
    throw new PdfCompatibilityError("malformed_pdf", "PDF parsing failed.");
  } finally {
    await loadingTask.destroy();
  }
}
