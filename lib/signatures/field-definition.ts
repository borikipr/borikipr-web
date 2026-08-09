import { canonicalSignatureJson, sha256SignatureValue } from "./domain/crypto";

export type SignatureLayoutField = Readonly<{
  participantId: string;
  fieldType: "signature" | "initials" | "date" | "text";
  pageIndex: number;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  required: boolean;
  tabOrder: number;
  validationLimits: Readonly<Record<string, number>>;
}>;

function normalizeNumber(value: number) {
  if (!Number.isFinite(value)) throw new Error("signature_field_number_invalid");
  return Number(value.toFixed(9));
}

export function canonicalSignatureFieldDefinition(input: {
  documentVersionId: string;
  fields: readonly SignatureLayoutField[];
}) {
  return {
    schemaVersion: "signature-field-layout-v1",
    documentVersionId: input.documentVersionId,
    fields: input.fields
      .map((field) => ({
        participantId: field.participantId,
        fieldType: field.fieldType,
        pageIndex: field.pageIndex,
        normalizedX: normalizeNumber(field.normalizedX),
        normalizedY: normalizeNumber(field.normalizedY),
        normalizedWidth: normalizeNumber(field.normalizedWidth),
        normalizedHeight: normalizeNumber(field.normalizedHeight),
        required: field.required,
        tabOrder: field.tabOrder,
        validationLimits: field.validationLimits,
      }))
      .sort(
        (left, right) =>
          left.tabOrder - right.tabOrder ||
          left.pageIndex - right.pageIndex ||
          left.participantId.localeCompare(right.participantId) ||
          left.fieldType.localeCompare(right.fieldType)
      ),
  } as const;
}

export function hashSignatureFieldDefinition(input: {
  documentVersionId: string;
  fields: readonly SignatureLayoutField[];
}) {
  return sha256SignatureValue(
    canonicalSignatureJson(canonicalSignatureFieldDefinition(input))
  );
}
