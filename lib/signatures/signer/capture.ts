import {
  validateBoundedText,
  validateDrawnSignature,
  validateInitials,
  validateTypedSignature,
} from "../prototype/capture";
import { canonicalSignatureJson, sha256SignatureValue } from "../domain/crypto";
import type { DrawnStroke, PrototypeFieldValue } from "../prototype/types";
import type { SignatureFieldType } from "../domain/types";
import {
  isSignatureStyleId,
  normalizeSignatureStyleId,
  type SignatureStyleId,
} from "../signature-styles";

export type SignerCaptureInput =
  | Readonly<{ method: "drawn"; strokes: readonly DrawnStroke[] }>
  | Readonly<{ method: "typed"; value: string; style?: SignatureStyleId }>
  | Readonly<{ method: "date"; value: string }>
  | Readonly<{ method: "text"; value: string }>;

export function normalizeSignerCapture(
  fieldType: SignatureFieldType,
  input: SignerCaptureInput
): Readonly<{
  captureMethod: "drawn_vector" | "typed" | "system_date" | "text_entry";
  typedValue: string | null;
  valuePayload: Readonly<Record<string, unknown>> | null;
  valueSha256: string;
  prototypeValue: PrototypeFieldValue;
  signatureStyleId: SignatureStyleId | null;
}> {
  if (input.method === "drawn") {
    if (fieldType !== "signature" && fieldType !== "initials") {
      throw new Error("signature_capture_type_mismatch");
    }
    validateDrawnSignature(input.strokes);
    const payload = Object.freeze({ strokes: input.strokes });
    return {
      captureMethod: "drawn_vector",
      typedValue: null,
      valuePayload: payload,
      valueSha256: sha256SignatureValue(canonicalSignatureJson(payload)),
      prototypeValue: input,
      signatureStyleId: null,
    };
  }

  let value: string;
  if (input.method === "typed") {
    if (input.style !== undefined && !isSignatureStyleId(input.style)) {
      throw new Error("signature_style_invalid");
    }
    if (fieldType === "signature") value = validateTypedSignature(input.value);
    else if (fieldType === "initials") value = validateInitials(input.value);
    else throw new Error("signature_capture_type_mismatch");
  } else if (input.method === "date") {
    if (fieldType !== "date" || !/^\d{4}-\d{2}-\d{2}$/.test(input.value)) {
      throw new Error("signature_capture_type_mismatch");
    }
    const parsed = new Date(`${input.value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== input.value) {
      throw new Error("signature_date_invalid");
    }
    value = input.value;
  } else {
    if (fieldType !== "text") throw new Error("signature_capture_type_mismatch");
    if (/<\s*\/?\s*(script|iframe|object|embed)\b/i.test(input.value)) {
      throw new Error("signature_text_markup_rejected");
    }
    value = validateBoundedText(input.value);
  }
  const captureMethod = input.method === "typed" ? "typed" : "text_entry";
  const signatureStyleId = input.method === "typed" ? normalizeSignatureStyleId(input.style) : null;
  const prototypeValue = Object.freeze({
    ...input,
    value,
    ...(signatureStyleId ? { style: signatureStyleId } : {}),
  }) as PrototypeFieldValue;
  return {
    captureMethod,
    typedValue: value,
    valuePayload: signatureStyleId ? Object.freeze({ styleId: signatureStyleId }) : null,
    valueSha256: sha256SignatureValue(canonicalSignatureJson(prototypeValue)),
    prototypeValue,
    signatureStyleId,
  };
}
