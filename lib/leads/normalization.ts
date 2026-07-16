export type NormalizedLeadIdentity = {
  emailOriginal: string | null;
  emailNormalized: string | null;
  phoneOriginal: string | null;
  phoneNormalized: string | null;
};

export function preserveOriginalValue(value: string | null | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

export function normalizeEmail(value: string | null | undefined) {
  const original = preserveOriginalValue(value);

  if (!original || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(original)) {
    return null;
  }

  return original.toLowerCase();
}

export function normalizePuertoRicoUsPhone(value: string | null | undefined) {
  const original = preserveOriginalValue(value);

  if (!original || /[a-z]/i.test(original)) {
    return null;
  }

  const compact = original.replace(/[\s().-]/g, "");
  let nationalNumber: string;

  if (/^\+1\d{10}$/.test(compact)) {
    nationalNumber = compact.slice(2);
  } else if (/^1\d{10}$/.test(compact)) {
    nationalNumber = compact.slice(1);
  } else if (/^\d{10}$/.test(compact)) {
    nationalNumber = compact;
  } else {
    return null;
  }

  if (!/^[2-9]\d{2}[2-9]\d{6}$/.test(nationalNumber)) {
    return null;
  }

  return `+1${nationalNumber}`;
}

export function normalizeLeadIdentity(input: {
  email?: string | null;
  phone?: string | null;
}): NormalizedLeadIdentity {
  return {
    emailOriginal: preserveOriginalValue(input.email),
    emailNormalized: normalizeEmail(input.email),
    phoneOriginal: preserveOriginalValue(input.phone),
    phoneNormalized: normalizePuertoRicoUsPhone(input.phone),
  };
}

export function normalizeNameForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
