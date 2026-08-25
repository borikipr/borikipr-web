import type { SignatureFieldType, SignatureFieldValidationLimits } from "./domain/types";
import { fieldChoiceOptions, SIGNATURE_FIELD_LABELS } from "./field-options";

export type SignatureVisualFieldType = SignatureFieldType;

export type SignatureVisualField = Readonly<{
  id: string;
  fieldType: SignatureVisualFieldType;
  pageIndex: number;
  normalizedX: number;
  normalizedY: number;
  normalizedWidth: number;
  normalizedHeight: number;
  label?: string;
  validationLimits?: SignatureFieldValidationLimits;
}>;

export type SignatureVisualPreflightIssue = Readonly<{
  id: string;
  code: "outside_page" | "partially_outside_page" | "field_too_small" | "field_overlap" | "margin_position";
  severity: "critical" | "warning";
  pageIndex: number;
  fieldIds: readonly string[];
  message: string;
}>;

const MINIMUM_SIZE: Readonly<Record<SignatureVisualFieldType, Readonly<{ width: number; height: number }>>> = {
  signature: { width: 0.18, height: 0.055 },
  initials: { width: 0.07, height: 0.04 },
  date: { width: 0.12, height: 0.035 },
  date_signed: { width: 0.14, height: 0.035 },
  text: { width: 0.08, height: 0.03 },
  checkbox: { width: 0.025, height: 0.025 },
  radio: { width: 0.12, height: 0.04 },
  dropdown: { width: 0.14, height: 0.035 },
  number: { width: 0.09, height: 0.03 },
  email: { width: 0.16, height: 0.03 },
  phone: { width: 0.12, height: 0.03 },
  signer_name: { width: 0.14, height: 0.035 },
};

function fieldName(field: SignatureVisualField) {
  return field.label?.trim() || SIGNATURE_FIELD_LABELS[field.fieldType];
}
function overlapRatio(left: SignatureVisualField, right: SignatureVisualField) {
  const width = Math.max(0, Math.min(left.normalizedX + left.normalizedWidth, right.normalizedX + right.normalizedWidth) -
    Math.max(left.normalizedX, right.normalizedX));
  const height = Math.max(0, Math.min(left.normalizedY + left.normalizedHeight, right.normalizedY + right.normalizedHeight) -
    Math.max(left.normalizedY, right.normalizedY));
  const intersection = width * height;
  const smallest = Math.min(left.normalizedWidth * left.normalizedHeight, right.normalizedWidth * right.normalizedHeight);
  return smallest > 0 ? intersection / smallest : 0;
}

export function evaluateSignatureVisualPreflight(fields: readonly SignatureVisualField[]) {
  const issues: SignatureVisualPreflightIssue[] = [];
  for (const field of fields) {
    const right = field.normalizedX + field.normalizedWidth;
    const bottom = field.normalizedY + field.normalizedHeight;
    const completelyOutside = right <= 0 || bottom <= 0 || field.normalizedX >= 1 || field.normalizedY >= 1;
    const partiallyOutside = !completelyOutside &&
      (field.normalizedX < 0 || field.normalizedY < 0 || right > 1 || bottom > 1);
    if (completelyOutside || partiallyOutside) {
      issues.push({
        id: `${completelyOutside ? "outside" : "partial"}:${field.id}`,
        code: completelyOutside ? "outside_page" : "partially_outside_page",
        severity: "critical",
        pageIndex: field.pageIndex,
        fieldIds: [field.id],
        message: completelyOutside
          ? `${fieldName(field)} está fuera de la página.`
          : `${fieldName(field)} está parcialmente fuera de la página.`,
      });
    }
    const minimum = MINIMUM_SIZE[field.fieldType];
    if (field.normalizedWidth < minimum.width || field.normalizedHeight < minimum.height) {
      issues.push({
        id: `small:${field.id}`,
        code: "field_too_small",
        severity: "critical",
        pageIndex: field.pageIndex,
        fieldIds: [field.id],
        message: `El campo ${fieldName(field)} es demasiado pequeño para mostrarse correctamente.`,
      });
    }
    if ((field.fieldType === "radio" || field.fieldType === "dropdown") &&
      fieldChoiceOptions(field.validationLimits ?? {}).length < 2) {
      issues.push({
        id: `options:${field.id}`,
        code: "field_too_small",
        severity: "critical",
        pageIndex: field.pageIndex,
        fieldIds: [field.id],
        message: `${fieldName(field)} necesita al menos dos opciones distintas.`,
      });
    }
    if (field.fieldType === "dropdown") {
      const longest = Math.max(0, ...fieldChoiceOptions(field.validationLimits ?? {}).map((option) => option.length));
      if (longest > 24 && field.normalizedWidth < 0.2) {
        issues.push({
          id: `choice-width:${field.id}`,
          code: "field_too_small",
          severity: "warning",
          pageIndex: field.pageIndex,
          fieldIds: [field.id],
          message: `${fieldName(field)} puede ser estrecho para su opción más larga.`,
        });
      }
    }
    const margin = Math.min(field.normalizedX, field.normalizedY, 1 - right, 1 - bottom);
    if (!partiallyOutside && !completelyOutside && margin < 0.012 &&
      (["signature", "date_signed", "text", "dropdown", "signer_name"].includes(field.fieldType))) {
      issues.push({
        id: `margin:${field.id}`,
        code: "margin_position",
        severity: "warning",
        pageIndex: field.pageIndex,
        fieldIds: [field.id],
        message: `${fieldName(field)} está muy cerca del margen. Confirma que la posición es intencional.`,
      });
    }
  }

  for (let leftIndex = 0; leftIndex < fields.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < fields.length; rightIndex += 1) {
      const left = fields[leftIndex];
      const right = fields[rightIndex];
      if (left.pageIndex !== right.pageIndex || overlapRatio(left, right) < 0.08) continue;
      issues.push({
        id: `overlap:${left.id}:${right.id}`,
        code: "field_overlap",
        severity: "critical",
        pageIndex: left.pageIndex,
        fieldIds: [left.id, right.id],
        message: `${fieldName(left)} y ${fieldName(right)} se superponen.`,
      });
    }
  }

  const criticalCount = issues.filter((issue) => issue.severity === "critical").length;
  const warningCount = issues.length - criticalCount;
  return { issues, criticalCount, warningCount, sendBlocked: criticalCount > 0 } as const;
}
