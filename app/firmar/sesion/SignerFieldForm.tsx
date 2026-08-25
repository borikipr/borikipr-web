"use client";

import { IconSignature, IconX } from "@tabler/icons-react";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
} from "react";
import {
  DEFAULT_SIGNATURE_STYLE_ID,
  SIGNATURE_STYLES,
  deriveSuggestedInitials,
  type SignatureStyleId,
} from "@/lib/signatures/signature-styles";
import SignerActionForm from "./SignerActionForm";

type Field = Readonly<{
  id: string;
  field_type: "signature" | "initials" | "date" | "date_signed" | "text";
  label: string;
  required: boolean;
  completed: boolean;
}>;

export default function SignerFieldForm({
  field,
  csrf,
  participantName,
}: {
  field: Field;
  csrf: string;
  participantName: string;
}) {
  const signatureLike =
    field.field_type === "signature" || field.field_type === "initials";
  const [method, setMethod] = useState(
    field.field_type === "signature" ? "typed" : field.field_type,
  );
  const [style, setStyle] = useState<SignatureStyleId>(
    DEFAULT_SIGNATURE_STYLE_ID,
  );
  const [typedValue, setTypedValue] = useState(
    field.field_type === "initials"
      ? deriveSuggestedInitials(participantName)
      : participantName,
  );
  const [strokes, setStrokes] = useState<{ x: number; y: number }[][]>([]);
  const [adoptionOpen, setAdoptionOpen] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const activePointerId = useRef<number | null>(null);

  useEffect(() => {
    if (!adoptionOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [adoptionOpen]);

  function closeAdoption() {
    setAdoptionOpen(false);
    window.setTimeout(() => opener.current?.focus(), 0);
  }

  function dialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAdoption();
      return;
    }
    if (event.key !== "Tab" || !dialog.current) return;
    const focusable = [
      ...dialog.current.querySelectorAll<HTMLElement>(
        "button,input,canvas,[tabindex]:not([tabindex='-1'])",
      ),
    ].filter((node) => !node.hasAttribute("disabled"));
    if (!focusable.length) return;
    const first = focusable[0],
      last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

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
      context.lineCap = "round";
      context.lineJoin = "round";
      context.lineWidth = 2;
      context.strokeStyle = "#0d1b2a";
      context.beginPath();
      context.moveTo(start.x * bounds.width, start.y * bounds.height);
    }
  }

  function move(event: PointerEvent<HTMLCanvasElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    event.preventDefault();
    const next = point(event);
    setStrokes((current) =>
      current.map((stroke, index) =>
        index === current.length - 1 ? [...stroke, next] : stroke,
      ),
    );
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
    setStrokes((current) =>
      current.map((stroke, index) =>
        index === current.length - 1 ? [...stroke, end] : stroke,
      ),
    );
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
    setStrokes((current) =>
      current.map((stroke, index) =>
        index === current.length - 1 ? [...stroke, end] : stroke,
      ),
    );
    const context = canvas.current?.getContext("2d");
    if (context) {
      context.lineTo(end.x * bounds.width, end.y * bounds.height);
      context.stroke();
    }
    activePointerId.current = null;
  }

  function clearDrawing() {
    const context = canvas.current?.getContext("2d");
    if (context && canvas.current)
      context.clearRect(0, 0, canvas.current.width, canvas.current.height);
    setStrokes([]);
  }

  if (field.completed) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950">
        {field.label}: completado
      </div>
    );
  }

  if (field.field_type === "date_signed") {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="font-medium">
          {field.label}
          {field.required ? " *" : ""}
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Borikí colocará automáticamente la fecha real cuando completes tu
          firma.
        </p>
      </div>
    );
  }

  const selectedStyle = SIGNATURE_STYLES.find(
    (candidate) => candidate.id === style,
  )!;
  const submitLabel =
    field.field_type === "signature"
      ? method === "drawn"
        ? "Adoptar firma dibujada"
        : "Adoptar y continuar"
      : field.field_type === "initials"
        ? "Adoptar iniciales"
        : "Guardar campo";

  return (
    <SignerActionForm
      action="/api/signatures/session/field"
      destination="/firmar/sesion"
      errorMessage="No se pudo guardar el campo. Verifica que la sesión siga vigente e intenta nuevamente."
      className="signer-field-card"
    >
      {signatureLike && !adoptionOpen ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-950">
              {field.label}
              {field.required ? " *" : ""}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              Elige escribir o dibujar tu{" "}
              {field.field_type === "initials" ? "inicial" : "firma"}.
            </p>
          </div>
          <button
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#0d1b2a] px-4 py-2 text-sm font-semibold text-white"
            onClick={() => setAdoptionOpen(true)}
            ref={opener}
            type="button"
          >
            <IconSignature aria-hidden="true" size={19} />
            Adoptar {field.field_type === "initials" ? "iniciales" : "firma"}
          </button>
        </div>
      ) : null}
      <div
        className={
          signatureLike
            ? adoptionOpen
              ? "signature-adoption-backdrop"
              : "hidden"
            : ""
        }
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) closeAdoption();
        }}
      >
        <div
          aria-labelledby={
            signatureLike ? `signature-adoption-title-${field.id}` : undefined
          }
          aria-modal={signatureLike ? "true" : undefined}
          className={signatureLike ? "signature-adoption-dialog" : ""}
          onKeyDown={signatureLike ? dialogKeyDown : undefined}
          ref={signatureLike ? dialog : undefined}
          role={signatureLike ? "dialog" : undefined}
        >
          {signatureLike ? (
            <div className="signature-adoption-header">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.1em] text-[#11518b]">
                  Borikí Sign
                </p>
                <h2
                  className="mt-1 text-2xl font-semibold"
                  id={`signature-adoption-title-${field.id}`}
                >
                  Adopta{" "}
                  {field.field_type === "initials"
                    ? "tus iniciales"
                    : "tu firma"}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Escoge una representación para este documento.
                </p>
              </div>
              <button
                aria-label="Cerrar adopción de firma"
                className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
                onClick={closeAdoption}
                type="button"
              >
                <IconX aria-hidden="true" size={20} />
              </button>
            </div>
          ) : null}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <label className="font-semibold text-slate-950">
              {field.label}
              {field.required ? " *" : ""}
            </label>
            {field.field_type === "signature" && (
              <div
                className="signature-adoption-tabs"
                role="tablist"
                aria-label="Método de firma"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === "typed"}
                  onClick={() => setMethod("typed")}
                  className={`min-h-10 rounded-md px-4 text-sm font-semibold ${method === "typed" ? "bg-[#11518b] text-white" : "text-slate-700"}`}
                >
                  Escribir
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={method === "drawn"}
                  onClick={() => setMethod("drawn")}
                  className={`min-h-10 rounded-md px-4 text-sm font-semibold ${method === "drawn" ? "bg-[#11518b] text-white" : "text-slate-700"}`}
                >
                  Dibujar
                </button>
              </div>
            )}
          </div>

          <input type="hidden" name="csrf" value={csrf} />
          <input type="hidden" name="fieldId" value={field.id} />
          <input
            type="hidden"
            name="method"
            value={
              method === "drawn" ? "drawn" : signatureLike ? "typed" : method
            }
          />

          {method === "drawn" ? (
            <div className="mt-4">
              <p className="text-sm text-slate-600">
                Dibuja dentro del recuadro. Puedes borrar y volver a intentar
                antes de adoptar.
              </p>
              <canvas
                ref={canvas}
                width={600}
                height={180}
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerCancel={up}
                onMouseUp={mouseUp}
                className="mt-3 h-40 w-full touch-none rounded-lg border-2 border-slate-300 bg-white"
                aria-label="Área para dibujar la firma"
              />
              <input
                type="hidden"
                name="strokes"
                value={JSON.stringify(strokes)}
              />
              <button
                className="mt-3 min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
                onClick={clearDrawing}
                type="button"
              >
                Borrar y volver a dibujar
              </button>
            </div>
          ) : signatureLike ? (
            <div className="mt-4 space-y-5">
              <div>
                <label
                  htmlFor={`signature-value-${field.id}`}
                  className="text-sm font-medium text-slate-800"
                >
                  {field.field_type === "initials"
                    ? "Confirma tus iniciales"
                    : "Confirma tu nombre completo"}
                </label>
                <input
                  id={`signature-value-${field.id}`}
                  name="value"
                  value={typedValue}
                  onChange={(event) => setTypedValue(event.target.value)}
                  maxLength={field.field_type === "initials" ? 8 : 120}
                  required={field.required}
                  autoComplete="name"
                  className="mt-2 block min-h-12 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-[#11518b]"
                />
                {field.field_type === "initials" && (
                  <p className="mt-2 text-xs text-slate-600">
                    Esta es una sugerencia basada en tu nombre. Revísala antes
                    de adoptar.
                  </p>
                )}
              </div>

              <fieldset>
                <legend className="text-sm font-semibold text-slate-900">
                  Elige un estilo
                </legend>
                <div className="signature-style-grid">
                  {SIGNATURE_STYLES.map((candidate) => {
                    const selected = candidate.id === style;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${candidate.label}: seleccionar este estilo de firma`}
                        onClick={() => setStyle(candidate.id)}
                        className={`signature-style-option ${selected ? "is-selected" : ""}`}
                      >
                        <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                          {candidate.label}
                        </span>
                        <span
                          className="mt-2 block min-h-12 overflow-hidden text-3xl leading-tight text-[#0d1b2a]"
                          style={{
                            fontFamily: `"${candidate.fontFamily}", cursive`,
                          }}
                        >
                          {typedValue || participantName}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="signature-adoption-preview">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-600">
                  Vista previa · {selectedStyle.label}
                </p>
                <p
                  className="mt-2 min-h-14 overflow-hidden text-4xl leading-tight text-[#0d1b2a] sm:text-5xl"
                  style={{
                    fontFamily: `"${selectedStyle.fontFamily}", cursive`,
                  }}
                >
                  {typedValue || participantName}
                </p>
              </div>
              <input type="hidden" name="style" value={style} />
            </div>
          ) : (
            <input
              name="value"
              type={field.field_type === "date" ? "date" : "text"}
              maxLength={field.field_type === "text" ? 500 : 120}
              required={field.required}
              className="mt-3 block min-h-12 w-full rounded-lg border border-slate-300 p-2"
            />
          )}

          <button className="signature-adoption-submit">
            {submitLabel}
          </button>
          {signatureLike && (
            <p className="mt-3 text-xs leading-5 text-slate-600">
              Al adoptar esta representación confirmas que deseas usarla como tu
              firma o iniciales electrónicas para este documento.
            </p>
          )}
        </div>
      </div>
    </SignerActionForm>
  );
}
