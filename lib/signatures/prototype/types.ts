export type PdfBox = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type PdfRotation = 0 | 90 | 180 | 270;

export type PdfPageGeometry = Readonly<{
  pageIndex: number;
  mediaBox: PdfBox;
  cropBox: PdfBox;
  rotation: PdfRotation;
  userUnit: number;
}>;

export type NormalizedRect = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

export type PdfPoint = Readonly<{ x: number; y: number }>;

export type PdfPlacement = Readonly<{
  bounds: PdfBox;
  corners: readonly [PdfPoint, PdfPoint, PdfPoint, PdfPoint];
  rotation: PdfRotation;
}>;

export type SignatureFieldType = import("../domain/types").SignatureFieldType;

export type DrawnStroke = readonly PdfPoint[];

export type PrototypeFieldValue =
  | Readonly<{ method: "drawn"; strokes: readonly DrawnStroke[] }>
  | Readonly<{ method: "typed"; value: string; style?: SignatureStyleId }>
  | Readonly<{ method: "date"; value: string }>
  | Readonly<{ method: "text"; value: string }>
  | Readonly<{ method: "checkbox"; value: true }>;

export type PrototypeField = Readonly<{
  id: string;
  participantId: string;
  type: SignatureFieldType;
  pageIndex: number;
  rect: NormalizedRect;
  value: PrototypeFieldValue;
}>;

export type PrototypeParticipant = Readonly<{
  id: string;
  displayName: string;
  role: string;
  completedAt: string;
}>;

export type PdfCompatibilityLimits = Readonly<{
  maximumSourceBytes: number;
  maximumPages: number;
}>;

export type PdfCompatibilityReport = Readonly<{
  sourceSha256: string;
  byteSize: number;
  pdfVersion: string | null;
  pageCount: number;
  encrypted: boolean;
  hasAcroForm: boolean;
  hasXfa: boolean;
  embeddedFileCount: number;
  hasJavaScript: boolean;
  hasUnsupportedActions: boolean;
  existingSignatureCount: number;
  fontFamilies: readonly string[];
  metadataKeys: readonly string[];
  pages: readonly PdfPageGeometry[];
}>;

export type PrototypeEvidenceManifest = Readonly<{
  schemaVersion: "boriki-sign-final-v1";
  requestId: string;
  verificationId: string;
  sourceSha256: string;
  finalPdfSha256: string;
  fieldDefinitionSha256: string;
  certificate: Readonly<{
    appended: false;
    consentVersion: string;
    completedAt: string;
  }>;
  participants: readonly Readonly<{
    id: string;
    role: string;
    completedAt: string;
  }>[];
  fieldCaptures: readonly Readonly<{
    fieldId: string;
    participantId: string;
    fieldType: SignatureFieldType;
    captureMethod: PrototypeFieldValue["method"];
    adoptedValue?: string;
    adoptedStyle?: SignatureStyleId;
    captureSha256: string;
  }>[];
  eventPlaceholders: readonly string[];
}>;
import type { SignatureStyleId } from "../signature-styles";
