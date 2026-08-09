"use client";

import { useRef, useState, type PointerEvent } from "react";

type Field = Readonly<{ id: string; field_type: "signature" | "initials" | "date" | "text"; label: string; required: boolean; completed: boolean }>;

export default function SignerFieldForm({ field, csrf }: { field: Field; csrf: string }) {
  const [method, setMethod] = useState(field.field_type === "signature" ? "typed" : field.field_type);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  }
  function down(event: PointerEvent<HTMLCanvasElement>) { event.currentTarget.setPointerCapture(event.pointerId); setStrokes((current) => [...current, [point(event)]]); }
  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = point(event);
    setStrokes((current) => current.map((stroke, index) => index === current.length - 1 ? [...stroke, next] : stroke));
    const context = canvas.current?.getContext("2d");
    if (context) { const rect = event.currentTarget.getBoundingClientRect(); context.lineTo(next.x * rect.width, next.y * rect.height); context.stroke(); }
  }
  if (field.completed) return <div className="rounded-lg border bg-emerald-50 p-4">{field.label}: completado</div>;
  return (
    <form action="/api/signatures/session/field" method="post" className="rounded-lg border bg-white p-4">
      <label className="font-medium">{field.label}{field.required ? " *" : ""}</label>
      <input type="hidden" name="csrf" value={csrf} /><input type="hidden" name="fieldId" value={field.id} />
      {field.field_type === "signature" && <select name="method" value={method} onChange={(event) => setMethod(event.target.value)} className="ml-3 border p-1"><option value="typed">Firma escrita</option><option value="drawn">Firma dibujada</option></select>}
      {field.field_type !== "signature" && <input type="hidden" name="method" value={field.field_type === "initials" ? "typed" : field.field_type} />}
      {method === "drawn" ? <><canvas ref={canvas} width={600} height={180} onPointerDown={down} onPointerMove={move} className="mt-3 h-40 w-full touch-none border" aria-label="Área para dibujar la firma" /><input type="hidden" name="strokes" value={JSON.stringify(strokes)} /></> : <input name="value" type={field.field_type === "date" ? "date" : "text"} maxLength={field.field_type === "initials" ? 8 : field.field_type === "text" ? 500 : 120} required={field.required} className="mt-3 block w-full rounded border p-2" />}
      <button className="mt-3 rounded bg-blue-700 px-4 py-2 text-white">Guardar campo</button>
    </form>
  );
}
