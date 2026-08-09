import type {
  NormalizedRect,
  PdfPageGeometry,
  PdfPlacement,
  PdfPoint,
  PdfRotation,
} from "./types";

const EPSILON = 1e-9;

function assertUnitInterval(value: number, name: string) {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${name} must be between 0 and 1.`);
  }
}
export function normalizeRotation(angle: number): PdfRotation {
  const normalized = ((angle % 360) + 360) % 360;
  if (normalized === 0 || normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  throw new Error("PDF page rotation must be 0, 90, 180, or 270 degrees.");
}

export function validateNormalizedRect(rect: NormalizedRect) {
  assertUnitInterval(rect.x, "rect.x");
  assertUnitInterval(rect.y, "rect.y");
  assertUnitInterval(rect.width, "rect.width");
  assertUnitInterval(rect.height, "rect.height");
  if (rect.width <= 0 || rect.height <= 0) {
    throw new Error("Field dimensions must be greater than zero.");
  }
  if (rect.x + rect.width > 1 + EPSILON || rect.y + rect.height > 1 + EPSILON) {
    throw new Error("Field must fit inside the displayed page.");
  }
}

export function normalizedDisplayPointToPdf(
  point: PdfPoint,
  geometry: PdfPageGeometry
): PdfPoint {
  assertUnitInterval(point.x, "point.x");
  assertUnitInterval(point.y, "point.y");
  const { x, y, width, height } = geometry.cropBox;
  switch (geometry.rotation) {
    case 0:
      return { x: x + point.x * width, y: y + (1 - point.y) * height };
    case 90:
      return { x: x + point.y * width, y: y + point.x * height };
    case 180:
      return { x: x + (1 - point.x) * width, y: y + point.y * height };
    case 270:
      return { x: x + (1 - point.y) * width, y: y + (1 - point.x) * height };
  }
}

export function normalizedRectToPdfPlacement(
  rect: NormalizedRect,
  geometry: PdfPageGeometry
): PdfPlacement {
  validateNormalizedRect(rect);
  const corners = [
    normalizedDisplayPointToPdf({ x: rect.x, y: rect.y }, geometry),
    normalizedDisplayPointToPdf({ x: rect.x + rect.width, y: rect.y }, geometry),
    normalizedDisplayPointToPdf(
      { x: rect.x + rect.width, y: rect.y + rect.height },
      geometry
    ),
    normalizedDisplayPointToPdf({ x: rect.x, y: rect.y + rect.height }, geometry),
  ] as const;
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  return {
    bounds: {
      x: Math.min(...xs),
      y: Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      height: Math.max(...ys) - Math.min(...ys),
    },
    corners,
    rotation: geometry.rotation,
  };
}

export function fieldPointToPagePoint(
  fieldRect: NormalizedRect,
  fieldPoint: PdfPoint,
  geometry: PdfPageGeometry
) {
  assertUnitInterval(fieldPoint.x, "fieldPoint.x");
  assertUnitInterval(fieldPoint.y, "fieldPoint.y");
  return normalizedDisplayPointToPdf(
    {
      x: fieldRect.x + fieldPoint.x * fieldRect.width,
      y: fieldRect.y + fieldPoint.y * fieldRect.height,
    },
    geometry
  );
}
