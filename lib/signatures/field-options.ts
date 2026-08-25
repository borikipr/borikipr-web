import type { SignatureFieldType, SignatureFieldValidationLimits } from "./domain/types";

export const SIGNATURE_FIELD_LABELS: Readonly<Record<SignatureFieldType, string>> = {
  signature: "Firma",
  initials: "Iniciales",
  date: "Fecha",
  date_signed: "Fecha de firma",
  text: "Texto",
  checkbox: "Casilla",
  radio: "Selección exclusiva",
  dropdown: "Lista desplegable",
  number: "Número",
  email: "Correo",
  phone: "Teléfono",
  signer_name: "Nombre del firmante",
};

export const MAX_CHOICE_OPTIONS = 12;

export function normalizeChoiceOptions(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80);
    if (normalized) unique.add(normalized);
    if (unique.size === MAX_CHOICE_OPTIONS) break;
  }
  return [...unique];
}

export function fieldChoiceOptions(limits: SignatureFieldValidationLimits) {
  return normalizeChoiceOptions(limits.options);
}

export function fieldMaxLength(limits: SignatureFieldValidationLimits, fallback = 120) {
  const value = Number(limits.maxLength);
  return Number.isInteger(value) ? Math.min(Math.max(value, 1), 500) : fallback;
}

export function parseChoiceOptionsText(value: string) {
  return normalizeChoiceOptions(value.split(/\r?\n/));
}

export function isChoiceField(type: SignatureFieldType) {
  return type === "radio" || type === "dropdown";
}
