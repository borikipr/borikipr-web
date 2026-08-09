import type { DrawnStroke } from "./types";

export const MAX_DRAWN_SIGNATURE_STROKES = 32;
export const MAX_DRAWN_SIGNATURE_POINTS = 2_000;
export const MAX_TYPED_SIGNATURE_CHARACTERS = 120;
export const MAX_INITIALS_CHARACTERS = 8;
export const MAX_TEXT_FIELD_CHARACTERS = 500;

function assertBoundedText(value: string, maximum: number, label: string) {
  const normalized = value.normalize("NFC").trim();
  if (!normalized) throw new Error(`${label} cannot be empty.`);
  if ([...normalized].length > maximum) {
    throw new Error(`${label} exceeds the ${maximum}-character limit.`);
  }
  if (/\p{C}/u.test(normalized)) {
    throw new Error(`${label} contains unsupported control characters.`);
  }
  return normalized;
}
export function validateTypedSignature(value: string) {
  return assertBoundedText(value, MAX_TYPED_SIGNATURE_CHARACTERS, "Typed signature");
}

export function validateInitials(value: string) {
  return assertBoundedText(value, MAX_INITIALS_CHARACTERS, "Initials");
}

export function validateBoundedText(value: string) {
  return assertBoundedText(value, MAX_TEXT_FIELD_CHARACTERS, "Text field");
}

export function validateDrawnSignature(strokes: readonly DrawnStroke[]) {
  if (strokes.length === 0 || strokes.length > MAX_DRAWN_SIGNATURE_STROKES) {
    throw new Error("Drawn signature stroke count is outside the allowed range.");
  }
  let points = 0;
  for (const stroke of strokes) {
    if (stroke.length < 2) throw new Error("Each drawn stroke requires at least two points.");
    points += stroke.length;
    for (const point of stroke) {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.x < 0 ||
        point.x > 1 ||
        point.y < 0 ||
        point.y > 1
      ) {
        throw new Error("Drawn signature points must use normalized coordinates.");
      }
    }
  }
  if (points > MAX_DRAWN_SIGNATURE_POINTS) {
    throw new Error("Drawn signature exceeds the maximum point count.");
  }
  return { strokeCount: strokes.length, pointCount: points };
}
