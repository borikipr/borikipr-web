"use client";

import { useRef, useState, type MouseEvent, type PointerEvent } from "react";
import SignerActionForm from "./SignerActionForm";

type Field = Readonly<{
  id: string;
  field_type: "signature" | "initials" | "date" | "date_signed" | "text";
  label: string;
  required: boolean;
  completed: boolean;
}>;

export default function SignerFieldForm({ field, csrf }: { field: Field; csrf: string }) {
  const [method, setMethod] = useState(field.field_type === "signature" ? "typed" : field.field_type);
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const activePointerId = useRef<number | null>(null);

  function point(event: PointerEvent<HTMLCanvasElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
  }

  function down(event: PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const start = point(event);
    activePointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setStrokes((current) => [...current, [start]]);
    const context = canvas.current?.getContext("2d");
    const bounds = event.currentTarget.getBoundingClientRect();
    if (context) {
      context.beginPath();
      context.moveTo(start.x * bounds.width, start.y * bounds.height);
    }
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const next = point(event);
    setStrokes((current) => current.map((stroke, index) =>
      index === current.length - 1 ? [...stroke, next] : stroke
    ));
    const context = canvas.current?.getContext("2d");
    if (context) {
      const rect = event.currentTarget.getBoundingClientRect();
      context.lineTo(next.x * rect.width, next.y * rect.height);
      context.stroke();
    }
  }

  function up(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const end = point(event);
    setStrokes((current) => current.map((stroke, index) =>
      index === current.length - 1 ? [...stroke, end] : stroke
    ));
    const context = canvas.current?.getContext("2d");
    if (context) {
      const rect = event.currentTarget.getBoundingClientRect();
      context.lineTo(end.x * rect.width, end.y * rect.height);
      context.stroke();
    }
    event.currentTarget.releasePointerCapture(event.pointerId);
    activePointerId.current = null;
  }

  function mouseUp(event: MouseEvent<HTMLCanvasElement>) {
    if (activePointerId.current === null) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const end = {
      x: (event.clientX - bounds.left) / bounds.width,
      y: (event.clientY - bounds.top) / bounds.height,
    };
    setStrokes((current) => current.map((stroke, index) =>
      index === current.length - 1 ? [...stroke, end] : stroke
    ));
    const context = canvas.current?.getContext("2d");
    if (context) {
      context.lineTo(end.x * bounds.width, end.y * bounds.height);
      context.stroke();
    }
    activePointerId.current = null;
  }

  function clearDrawing() {
    const context = canvas.current?.getContext("2d");
    if (context && canvas.current) {
      context.clearRect(0, 0, canvas.current.width, canvas.current.height);
    }
    setStrokes([]);
  }

  if (field.completed) {
    return <div className="rounded-lg border bg-emerald-50 p-4">{field.label}: completado</div>;
  }

  if (field.field_type === "date_signed") {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <p className="font-medium">{field.label}{field.required ? " *" : ""}</p>
      <p className="mt-1 text-sm text-slate-700">Borikí colocará automáticamente la fecha real cuando completes tu firma.</p>
    </div>;
  }

  return (
    <SignerActionForm
      action="/api/signatures/session/field"
      destination="/firmar/sesion"
      errorMessage="No se pudo guardar el campo. Verifica que la sesión siga vigente e intenta nuevamente."
      className="rounded-lg border bg-white p-4"
    >
      <label className="font-medium">{field.label}{field.required ? " *" : ""}</label>
      <input type="hidden" name="csrf" value={csrf} />
      <input type="hidden" name="fieldId" value={field.id} />
      {field.field_type === "signature" && (
        <select name="method" value={method} onChange={(event) => setMethod(event.target.value)} className="ml-3 border p-1">
          <option value="typed">Firma escrita</option>
          <option value="drawn">Firma dibujada</option>
        </select>
      )}
      {field.field_type !== "signature" && (
        <input type="hidden" name="method" value={field.field_type === "initials" ? "typed" : field.field_type} />
      )}
      {method === "drawn" ? (
        <>
          <canvas
            ref={canvas}
            width={600}
            height={180}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onMouseUp={mouseUp}
            className="mt-3 h-40 w-full touch-none border"
            aria-label="Área para dibujar la firma"
          />
          <input type="hidden" name="strokes" value={JSON.stringify(strokes)} />
          <button className="mt-2 rounded border border-slate-400 px-3 py-2 text-sm" onClick={clearDrawing} type="button">
            Borrar y volver a dibujar
          </button>
        </>
      ) : (
        <input
          name="value"
          type={field.field_type === "date" ? "date" : "text"}
          maxLength={field.field_type === "initials" ? 8 : field.field_type === "text" ? 500 : 120}
          required={field.required}
          className="mt-3 block w-full rounded border p-2"
        />
      )}
      <button className="mt-3 rounded bg-blue-700 px-4 py-2 text-white">Guardar campo</button>
    </SignerActionForm>
  );
}
