import {
  validateBoundedText,
  validateDrawnSignature,
  validateInitials,
  validateTypedSignature,
} from "../prototype/capture";
import { canonicalSignatureJson, sha256SignatureValue } from "../domain/crypto";
import type { DrawnStroke, PrototypeFieldValue } from "../prototype/types";
import type { SignatureFieldType, SignatureFieldValidationLimits } from "../domain/types";
import { fieldChoiceOptions, fieldMaxLength } from "../field-options";
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
  input: SignerCaptureInput,
  validationLimits: SignatureFieldValidationLimits = {},
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
    if (fieldType === "signer_name" || fieldType === "date_signed" || fieldType === "signature" || fieldType === "initials" || fieldType === "date") {
      throw new Error("signature_capture_type_mismatch");
    }
    if (/<\s*\/?\s*(script|iframe|object|embed)\b/i.test(input.value)) {
      throw new Error("signature_text_markup_rejected");
    }
    value = validateBoundedText(input.value).trim();
    if (fieldType === "checkbox") {
      if (value !== "true") throw new Error("signature_checkbox_required");
    } else if (fieldType === "radio" || fieldType === "dropdown") {
      const options = fieldChoiceOptions(validationLimits);
      if (options.length < 2 || !options.includes(value)) throw new Error("signature_choice_invalid");
    } else if (fieldType === "number") {
      if (!/^-?\d+(?:\.\d+)?$/.test(value)) throw new Error("signature_number_invalid");
      if (validationLimits.allowDecimals === false && value.includes(".")) throw new Error("signature_number_decimals_invalid");
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) throw new Error("signature_number_invalid");
      if (typeof validationLimits.min === "number" && numeric < validationLimits.min) throw new Error("signature_number_min");
      if (typeof validationLimits.max === "number" && numeric > validationLimits.max) throw new Error("signature_number_max");
    } else if (fieldType === "email") {
      if (value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Error("signature_email_invalid");
    } else if (fieldType === "phone") {
      if (value.length > 50 || !/^[+()\d\s.-]+$/.test(value) || value.replace(/\D/g, "").length < 7) throw new Error("signature_phone_invalid");
    } else if (fieldType === "text" && value.length > fieldMaxLength(validationLimits, 500)) {
      throw new Error("signature_text_too_long");
    }
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
