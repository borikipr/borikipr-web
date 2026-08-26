"use client";

import { useCallback, useEffect, useRef, type PointerEvent } from "react";
import {
  appendDrawingPoints,
  MAX_DRAWING_STROKES,
  normalizedDrawingPoint,
} from "@/lib/signatures/drawing";
import type { DrawnStroke, PdfPoint } from "@/lib/signatures/prototype/types";

function renderStrokes(
  canvas: HTMLCanvasElement,
  strokes: readonly DrawnStroke[],
  kind: "signature" | "initials",
) {
  const bounds = canvas.getBoundingClientRect();
  const ratio = Math.min(window.devicePixelRatio || 1, 3);
  const width = Math.max(1, Math.round(bounds.width * ratio));
  const height = Math.max(1, Math.round(bounds.height * ratio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  const context = canvas.getContext("2d");
  if (!context) return;
  context.clearRect(0, 0, width, height);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = kind === "initials" ? 2.35 : 2.1;
  context.strokeStyle = "#0d1b2a";

  for (const stroke of strokes) {
    if (!stroke.length) continue;
    context.beginPath();
    context.moveTo(stroke[0].x * bounds.width, stroke[0].y * bounds.height);
    if (stroke.length === 2) {
      context.lineTo(stroke[1].x * bounds.width, stroke[1].y * bounds.height);
    } else {
      for (let index = 1; index < stroke.length - 1; index += 1) {
        const current = stroke[index];
        const next = stroke[index + 1];
        context.quadraticCurveTo(
          current.x * bounds.width,
          current.y * bounds.height,
          ((current.x + next.x) / 2) * bounds.width,
          ((current.y + next.y) / 2) * bounds.height,
        );
      }
      const last = stroke[stroke.length - 1];
      context.lineTo(last.x * bounds.width, last.y * bounds.height);
    }
    context.stroke();
  }
}

export default function DrawnMarkCanvas({
  kind,
  strokes,
  onChange,
  describedBy,
}: {
  kind: "signature" | "initials";
  strokes: readonly DrawnStroke[];
  onChange: (strokes: readonly DrawnStroke[]) => void;
  describedBy: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const activePointerId = useRef<number | null>(null);
  const strokesRef = useRef(strokes);

  const redraw = useCallback(() => {
    if (canvasRef.current) renderStrokes(canvasRef.current, strokesRef.current, kind);
  }, [kind]);

  useEffect(() => {
    strokesRef.current = strokes;
    redraw();
  }, [redraw, strokes]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(redraw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  function pointsFromEvent(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    return samples.map((sample) =>
      normalizedDrawingPoint(sample.clientX, sample.clientY, bounds),
    );
  }

  function begin(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.isPrimary || strokesRef.current.length >= MAX_DRAWING_STROKES) return;
    event.preventDefault();
    activePointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = pointsFromEvent(event).at(-1) ?? { x: 0, y: 0 };
    const next = Object.freeze([...strokesRef.current, Object.freeze([start])]);
    strokesRef.current = next;
    onChange(next);
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (activePointerId.current !== event.pointerId) return;
    event.preventDefault();
    const next = appendDrawingPoints(strokesRef.current, pointsFromEvent(event));
    strokesRef.current = next;
    onChange(next);
  }

  function finish(event: PointerEvent<HTMLCanvasElement>) {
    if (activePointerId.current !== event.pointerId) return;
    event.preventDefault();
    let next = appendDrawingPoints(strokesRef.current, pointsFromEvent(event));
    const last = next.at(-1);
    if (last?.length === 1) next = appendDrawingPoints(next, [last[0] as PdfPoint]);
    strokesRef.current = next;
    onChange(next);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    activePointerId.current = null;
  }

  return (
    <canvas
      aria-describedby={describedBy}
      aria-label={kind === "initials" ? "Área para dibujar las iniciales" : "Área para dibujar la firma"}
      className={`drawn-mark-canvas is-${kind}`}
      onPointerCancel={finish}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={finish}
      ref={canvasRef}
      tabIndex={0}
    />
  );
}
