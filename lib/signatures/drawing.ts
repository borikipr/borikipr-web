import type { DrawnStroke, PdfPoint } from "./prototype/types";

export const MAX_DRAWING_STROKES = 32;
export const MAX_DRAWING_POINTS = 2_000;

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function normalizedDrawingPoint(
  clientX: number,
  clientY: number,
  bounds: Readonly<{ left: number; top: number; width: number; height: number }>,
): PdfPoint {
  if (bounds.width <= 0 || bounds.height <= 0) return { x: 0, y: 0 };
  return {
    x: clamp((clientX - bounds.left) / bounds.width),
    y: clamp((clientY - bounds.top) / bounds.height),
  };
}

export function drawingPointCount(strokes: readonly DrawnStroke[]) {
  return strokes.reduce((total, stroke) => total + stroke.length, 0);
}

export function hasAdoptableDrawing(strokes: readonly DrawnStroke[]) {
  return strokes.length > 0 && strokes.every((stroke) => stroke.length >= 2);
}

export function appendDrawingPoints(
  strokes: readonly DrawnStroke[],
  points: readonly PdfPoint[],
): readonly DrawnStroke[] {
  if (!strokes.length || !points.length) return strokes;
  const available = Math.max(0, MAX_DRAWING_POINTS - drawingPointCount(strokes));
  if (!available) return strokes;
  const accepted = points.slice(0, available);
  const lastIndex = strokes.length - 1;
  return strokes.map((stroke, index) =>
    index === lastIndex ? Object.freeze([...stroke, ...accepted]) : stroke,
  );
}
