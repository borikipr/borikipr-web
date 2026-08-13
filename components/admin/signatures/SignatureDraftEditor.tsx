"use client";

import { startTransition, useActionState, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  addSignatureFieldAction,
  addSignatureParticipantAction,
  prepareSignatureSendAction,
  resendSignatureInvitationAction,
  expireSignatureDocumentAction,
  voidSignatureDocumentAction,
  removeSignatureFieldAction,
  updateSignatureFieldAction,
  deleteSignatureDraftAction,
  archiveSignatureDraftAction,
  type SignatureAdminActionState,
} from "@/app/admin/signatures/actions";
import type { SignatureDraftDetail } from "@/lib/signatures/admin-repository";
import type { SignatureSendReadiness } from "@/lib/signatures/send-readiness";
import type { SignaturePreflightResult } from "@/lib/signatures/preflight";

const INITIAL: SignatureAdminActionState = { ok: false, message: "" };
const COLORS = ["#11518b", "#8a5a00", "#6b3fa0", "#16704a", "#a33a3a", "#226e78", "#704214", "#565b66"];
const FIELD_LABELS = { signature: "Firma", initials: "Iniciales", date: "Fecha", text: "Texto" } as const;
type FieldType = keyof typeof FIELD_LABELS;
type Rect = { x: number; y: number; width: number; height: number };

function Feedback({ state }: { state: SignatureAdminActionState }) {
  return state.message ? <p aria-live="polite" className={`mt-3 text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}>{state.message}</p> : null;
}

function bounded(rect: Rect): Rect {
  const width = Math.min(Math.max(rect.width, 0.04), 1);
  const height = Math.min(Math.max(rect.height, 0.025), 1);
  return {
    x: Math.min(Math.max(rect.x, 0), 1 - width),
    y: Math.min(Math.max(rect.y, 0), 1 - height),
    width,
    height,
  };
}

function appendFieldData(form: FormData, input: {
  documentId: string;
  participantId: string;
  fieldType: FieldType;
  pageIndex: number;
  rect: Rect;
  label?: string;
  required?: boolean;
  maxLength?: number;
  fieldId?: string;
}) {
  form.set("documentId", input.documentId);
  if (input.fieldId) form.set("fieldId", input.fieldId);
  form.set("participantId", input.participantId);
  form.set("fieldType", input.fieldType);
  form.set("pageIndex", String(input.pageIndex));
  form.set("x", String(input.rect.x));
  form.set("y", String(input.rect.y));
  form.set("width", String(input.rect.width));
  form.set("height", String(input.rect.height));
  form.set("label", input.label ?? FIELD_LABELS[input.fieldType]);
  form.set("required", String(input.required ?? true));
  form.set("maxLength", String(input.maxLength ?? 120));
}

function FieldOverlay({
  documentId,
  field,
  color,
  zoom,
}: {
  documentId: string;
  field: SignatureDraftDetail["fields"][number];
  color: string;
  zoom: number;
}) {
  const initialRect = { x: field.normalizedX, y: field.normalizedY, width: field.normalizedWidth, height: field.normalizedHeight };
  const [rect, setRect] = useState(initialRect);
  const [state, action, pending] = useActionState(updateSignatureFieldAction, INITIAL);

  function persist(next: Rect) {
    const form = new FormData();
    appendFieldData(form, {
      documentId,
      fieldId: field.id,
      participantId: field.participantId,
      fieldType: field.fieldType,
      pageIndex: field.pageIndex,
      rect: next,
      label: field.label,
      required: field.required,
      maxLength: field.validationLimits.maxLength,
    });
    startTransition(() => action(form));
  }

  function begin(event: ReactPointerEvent<HTMLButtonElement>, mode: "move" | "resize") {
    event.preventDefault();
    const origin = { x: event.clientX, y: event.clientY, rect };
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    function move(pointer: PointerEvent) {
      const scale = Math.max(target.parentElement?.parentElement?.getBoundingClientRect().width ?? 1, 1);
      const dx = (pointer.clientX - origin.x) / scale;
      const dy = (pointer.clientY - origin.y) / scale;
      setRect(bounded(mode === "move"
        ? { ...origin.rect, x: origin.rect.x + dx, y: origin.rect.y + dy }
        : { ...origin.rect, width: origin.rect.width + dx, height: origin.rect.height + dy }));
    }
    function end(pointer: PointerEvent) {
      target.releasePointerCapture(pointer.pointerId);
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      const scale = Math.max(target.parentElement?.parentElement?.getBoundingClientRect().width ?? 1, 1);
      const dx = (pointer.clientX - origin.x) / scale;
      const dy = (pointer.clientY - origin.y) / scale;
      const next = bounded(mode === "move"
        ? { ...origin.rect, x: origin.rect.x + dx, y: origin.rect.y + dy }
        : { ...origin.rect, width: origin.rect.width + dx, height: origin.rect.height + dy });
      setRect(next);
      persist(next);
    }
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
  }

  function keyboard(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 0.01 : 0.002;
    const delta = event.key === "ArrowLeft" ? [-step, 0] : event.key === "ArrowRight" ? [step, 0] : event.key === "ArrowUp" ? [0, -step] : event.key === "ArrowDown" ? [0, step] : null;
    if (!delta) return;
    event.preventDefault();
    const next = bounded({ ...rect, x: rect.x + delta[0], y: rect.y + delta[1] });
    setRect(next);
    persist(next);
  }

  return (
    <div className="absolute" style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`, height: `${rect.height * 100}%`, zIndex: 10 }}>
      <button aria-label={`Mover campo ${field.label}. Usa las flechas para ajuste fino.`} className="flex h-full w-full cursor-move items-center justify-center overflow-hidden border-2 bg-white/80 px-1 text-center font-semibold shadow-sm focus:outline-none focus:ring-4 focus:ring-[#d4af37]/60" disabled={pending} onKeyDown={keyboard} onPointerDown={(event) => begin(event, "move")} style={{ borderColor: color, color, fontSize: `${Math.max(10, 12 * zoom)}px` }} type="button">{FIELD_LABELS[field.fieldType]}</button>
      <button aria-label={`Redimensionar campo ${field.label}`} className="absolute -bottom-1 -right-1 h-4 w-4 cursor-se-resize rounded-sm border border-white focus:outline-none focus:ring-2 focus:ring-[#d4af37]" onPointerDown={(event) => begin(event, "resize")} style={{ backgroundColor: color }} type="button" />
      <span className="sr-only" aria-live="polite">{state.message}</span>
    </div>
  );
}

const READINESS_LABELS: Record<string, string> = {
  document_not_draft: "El documento ya no está en borrador.",
  active_version_missing: "Falta la versión activa.",
  source_pdf_incompatible: "El PDF fuente no pasó la compatibilidad.",
  version_already_locked: "La versión ya está bloqueada.",
  expiration_invalid: "La fecha de expiración falta o no es válida.",
  event_keys_unavailable: "La configuración de evidencia no está disponible.",
  public_signing_disabled: "La firma pública permanece desactivada.",
  document_classification_approval_missing: "Este tipo de documento todavía no ha sido aprobado para firma electrónica.",
  approved_consent_missing: "Falta una versión de consentimiento aprobada.",
  participant_count_invalid: "La cantidad de participantes no es válida.",
  participant_email_invalid: "Hay un correo de participante inválido.",
  field_count_invalid: "La cantidad de campos no es válida.",
  required_participant_field_missing: "Cada participante necesita al menos un campo requerido.",
  field_definition_hash_stale: "La definición de campos cambió y debe recalcularse.",
};

export default function SignatureDraftEditor({ detail, readiness, preflight, activationMode }: { detail: SignatureDraftDetail; readiness: SignatureSendReadiness; preflight: SignaturePreflightResult; activationMode:"public"|"internal_canary"|"disabled" }) {
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [participantId, setParticipantId] = useState(detail.participants[0]?.id ?? "");
  const [participantState, participantAction, participantPending] = useActionState(addSignatureParticipantAction, INITIAL);
  const [fieldState, fieldAction, fieldPending] = useActionState(addSignatureFieldAction, INITIAL);
  const [sendState, sendAction, sendPending] = useActionState(prepareSignatureSendAction, INITIAL);
  const [resendState, resendAction, resendPending] = useActionState(resendSignatureInvitationAction, INITIAL);
  const [expireState, expireAction, expirePending] = useActionState(expireSignatureDocumentAction, INITIAL);
  const [voidState, voidAction, voidPending] = useActionState(voidSignatureDocumentAction, INITIAL);
  const [deleteState, deleteAction, deletePending] = useActionState(deleteSignatureDraftAction, INITIAL);
  const [archiveState, archiveAction, archivePending] = useActionState(archiveSignatureDraftAction, INITIAL);
  const canvasRef = useRef<HTMLDivElement>(null);

  function createField(fieldType: FieldType, rect: Rect) {
    if (!participantId) return;
    const form = new FormData();
    appendFieldData(form, { documentId: detail.id, participantId, fieldType, pageIndex, rect: bounded(rect) });
    startTransition(() => fieldAction(form));
  }

  function drop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const fieldType = event.dataTransfer.getData("application/x-borikipr-signature-field") as FieldType;
    if (!FIELD_LABELS[fieldType] || !canvasRef.current) return;
    const bounds = canvasRef.current.getBoundingClientRect();
    const width = fieldType === "initials" || fieldType === "date" ? 0.18 : 0.3;
    createField(fieldType, {
      x: (event.clientX - bounds.left) / bounds.width - width / 2,
      y: (event.clientY - bounds.top) / bounds.height - 0.035,
      width,
      height: 0.07,
    });
  }

  const participantColors = new Map(detail.participants.map((participant, index) => [participant.id, COLORS[index % COLORS.length]]));
  const pageFields = detail.fields.filter((field) => field.pageIndex === pageIndex);
  const pageGeometry = detail.version.pageGeometry[pageIndex];
  const rotated = pageGeometry?.rotation === 90 || pageGeometry?.rotation === 270;
  const displayWidth = rotated ? pageGeometry?.cropBox.height : pageGeometry?.cropBox.width;
  const displayHeight = rotated ? pageGeometry?.cropBox.width : pageGeometry?.cropBox.height;

  return (
    <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="surface-card min-w-0 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-xl font-semibold">Editor de campos</h2><p className="mt-1 text-sm text-[#555]">Arrastra un tipo al documento o usa el botón para colocarlo al centro.</p></div>
          <div className="flex items-center gap-2">
            <button className="btn-secondary" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => value - 1)} type="button">Anterior</button>
            <span className="text-sm font-semibold">{pageIndex + 1} / {detail.version.pageCount}</span>
            <button className="btn-secondary" disabled={pageIndex + 1 >= detail.version.pageCount} onClick={() => setPageIndex((value) => value + 1)} type="button">Siguiente</button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]">
          <label><span className="text-sm font-semibold">Participante asignado</span><select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-3 py-2" onChange={(event) => setParticipantId(event.target.value)} value={participantId}><option value="">Añade un participante primero</option>{detail.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name} · {participant.role}</option>)}</select></label>
          <label><span className="text-sm font-semibold">Zoom</span><select className="mt-2 block rounded-xl border border-[#d9d9d9] px-3 py-2" onChange={(event) => setZoom(Number(event.target.value))} value={zoom}><option value={0.75}>75%</option><option value={1}>100%</option><option value={1.25}>125%</option><option value={1.5}>150%</option></select></label>
        </div>

        <div aria-label="Tipos de campos" className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(FIELD_LABELS) as FieldType[]).map((type) => <button className="rounded-full border border-[#0d1b2a] bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50" disabled={!participantId || fieldPending} draggable onClick={() => createField(type, { x: 0.35, y: 0.45, width: type === "initials" || type === "date" ? 0.18 : 0.3, height: 0.07 })} onDragStart={(event) => event.dataTransfer.setData("application/x-borikipr-signature-field", type)} key={type} type="button">+ {FIELD_LABELS[type]}</button>)}
        </div>
        <Feedback state={fieldState} />

        <div className="mt-5 overflow-auto rounded-xl border border-[#d6d6d6] bg-[#ececec] p-3">
          <div className="mx-auto origin-top" style={{ width: `${zoom * 100}%`, maxWidth: `${zoom * 900}px` }}>
            <div aria-label={`Página ${pageIndex + 1} del PDF con campos de firma`} className="relative w-full bg-white shadow" onDragOver={(event) => event.preventDefault()} onDrop={drop} ref={canvasRef} style={{ aspectRatio: `${displayWidth ?? 612} / ${displayHeight ?? 792}` }}>
              {/* Private no-store server render; the R2 key is never exposed. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img alt={`Vista previa de la página ${pageIndex + 1}`} className="h-full w-full object-contain" draggable={false} src={`/admin/signatures/${detail.id}/pages/${pageIndex}`} />
              {pageFields.map((field) => <FieldOverlay color={participantColors.get(field.participantId) ?? COLORS[0]} documentId={detail.id} field={field} key={field.id} zoom={zoom} />)}
            </div>
          </div>
        </div>
      </section>

      <aside className="min-w-0 space-y-6">
        <section className="surface-card p-5" data-testid="signature-preflight">
          <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-semibold">Pre-flight server-side</h2><span className={`rounded-full px-3 py-1 text-xs font-bold ${preflight.overallStatus==="pass"?"bg-green-100 text-green-800":"bg-red-100 text-red-800"}`}>{preflight.overallStatus==="pass"?"LISTO":"BLOQUEADO"}</span></div>
          <p className="mt-2 text-sm text-slate-600">Estado: <strong>{preflight.state.replaceAll("_"," ").toUpperCase()}</strong>. Este resultado no autoriza ni activa firmas.</p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">{(["preparation","governance","recovery","security","authorization"] as const).map((category)=>{
            const entries=preflight.items.filter((entry)=>entry.category===category); if(!entries.length) return null;
            const labels={preparation:"Preparación",governance:"Gobernanza",recovery:"Recuperación",security:"Seguridad",authorization:"Autorización"};
            return <div className="min-w-0 rounded-xl border p-3" key={category}><h3 className="font-semibold">{labels[category]}</h3><ul className="mt-2 space-y-2 text-sm">{entries.map((entry)=><li className={entry.status==="blocked"?"text-red-800":"text-amber-800"} key={entry.code}><strong>{entry.status==="blocked"?"Rojo":"Amarillo"}:</strong> {entry.message}{entry.remediation&&<span className="block text-xs text-slate-600">Dónde corregir: {entry.remediation}</span>}</li>)}</ul></div>;
          })}</div>
          <p className="mt-3 break-all font-mono text-[11px] text-slate-500">Readiness SHA-256: {preflight.readinessHash}</p>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-lg font-semibold">Participantes ({detail.participants.length}/8)</h2>
          <ul className="mt-4 space-y-3">{detail.participants.map((participant, index) => <li className="rounded-xl border p-3" key={participant.id} style={{ borderLeftColor: COLORS[index % COLORS.length], borderLeftWidth: 5 }}><p className="font-semibold">{participant.name}</p><p className="break-all text-sm text-[#555]">{participant.email}</p><p className="mt-1 text-xs uppercase tracking-wide text-[#666]">{participant.role} · {participant.status}</p><p className="mt-1 text-xs text-[#666]">Última entrega: {participant.lastDeliveryStatus ?? "sin entrega"}</p>{participant.completedAt && <p className="mt-1 text-xs text-green-700">Completado: {new Date(participant.completedAt).toLocaleString("es-PR")}</p>}{["invited","viewed","consented"].includes(participant.status) && <form action={resendAction} className="mt-2"><input name="documentId" type="hidden" value={detail.id} /><input name="participantId" type="hidden" value={participant.id} /><button className="text-xs font-semibold text-[#11518b]" disabled={resendPending} type="submit">Reenviar invitación</button></form>}</li>)}</ul>
          <form action={participantAction} className="mt-5 space-y-3">
            <input name="documentId" type="hidden" value={detail.id} />
            <label className="block"><span className="text-sm font-semibold">Nombre</span><input className="mt-1 w-full rounded-lg border px-3 py-2" maxLength={160} name="name" required /></label>
            <label className="block"><span className="text-sm font-semibold">Correo</span><input className="mt-1 w-full rounded-lg border px-3 py-2" maxLength={320} name="email" required type="email" /></label>
            <label className="block"><span className="text-sm font-semibold">Rol</span><input className="mt-1 w-full rounded-lg border px-3 py-2" maxLength={80} name="role" required /></label>
            <label className="block"><span className="text-sm font-semibold">Orden (opcional)</span><input className="mt-1 w-full rounded-lg border px-3 py-2" max={8} min={1} name="routingOrder" type="number" /></label>
            <button className="btn-secondary" disabled={participantPending || detail.participants.length >= 8} type="submit">Añadir participante</button>
            <Feedback state={participantState} />
          </form>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-lg font-semibold">Campos ({detail.fields.length}/100)</h2>
          <div className="mt-4 space-y-3">
            {detail.fields.map((field) => <FieldSettings detail={detail} field={field} key={field.id} />)}
            {detail.fields.length === 0 && <p className="text-sm text-[#555]">Aún no hay campos.</p>}
          </div>
        </section>

        <section className="surface-card p-5">
          <h2 className="text-lg font-semibold">Preparación y activación</h2>
          <p className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{readiness.eligible ? "La solicitud cumple todos los controles para preparar invitaciones." : "Puedes continuar preparando el borrador; el envío permanece bloqueado hasta completar los controles."}</p>
          {!readiness.eligible && <div className="mt-4 space-y-4">
            {([
              ["Preparación del documento", ["document_not_found","document_not_draft","active_version_missing","source_pdf_incompatible","version_already_locked","expiration_invalid","participant_count_invalid","participant_email_invalid","field_count_invalid","required_participant_field_missing","field_definition_hash_stale"]],
              ["Gobernanza", ["document_classification_approval_missing","approved_consent_missing","retention_policy_missing","privacy_disclosure_missing","event_keys_unavailable"]],
              ["Activación", ["public_signing_disabled"]],
            ] as const).map(([heading,codes]) => {
              const matching=readiness.reasons.filter((reason)=>codes.includes(reason as never));
              return matching.length ? <div key={heading}><h3 className="text-sm font-semibold">{heading}</h3><ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#555]">{matching.map((reason)=><li key={reason}>{READINESS_LABELS[reason] ?? "Hay una validación pendiente que requiere revisión del operador."}</li>)}</ul></div> : null;
            })}
          </div>}
          <dl className="mt-3 grid gap-2 text-xs"><div><dt className="font-semibold">Consentimiento</dt><dd>{readiness.consentVersion ?? "No aprobado"}</dd></div><div><dt className="font-semibold">Clasificación del documento</dt><dd>{readiness.approvalReference ? "Aprobada para firma electrónica" : "Pendiente"}</dd></div></dl>
          <form action={sendAction} className="mt-4 grid gap-3 rounded-xl border p-3"><input name="documentId" type="hidden" value={detail.id} /><input name="documentType" type="hidden" value={detail.documentType} /><p className="text-sm font-bold">Modo: {activationMode==="public"?"FIRMA PÚBLICA — clientes externos":activationMode==="internal_canary"?"CANARY INTERNO — prueba controlada, NO disponible para clientes":"DESACTIVADO"}</p><p className="text-xs text-slate-600">Documento: {detail.title} · Clasificación: {detail.documentType} · Participantes: {detail.participants.length} · Locale: es-PR · Expira: {detail.expiresAt?new Date(detail.expiresAt).toLocaleString("es-PR"):"sin fecha"}</p><label className="flex items-start gap-2 text-sm"><input name="sendAcknowledged" type="checkbox" value="true" required /><span>Revisé documento, versión, participantes, correo, locale, expiración y gobernanza. El servidor volverá a validar todo antes de crear cada invitación.</span></label><label className="text-sm font-semibold">Escribe <code>{activationMode==="public"?"CONFIRMAR ENVIO PUBLICO":"CONFIRMAR ENVIO CANARY INTERNO"}</code><input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="sendConfirmationPhrase" required /></label><button className="btn-primary w-full disabled:opacity-60" disabled={sendPending || !readiness.eligible || activationMode==="disabled"} type="submit">{readiness.eligible&&activationMode!=="disabled" ? `Preparar invitaciones — ${activationMode==="public"?"FIRMA PÚBLICA":"CANARY INTERNO"}` : "Envío bloqueado"}</button></form>
          <Feedback state={sendState} />
          {!["draft","completed","voided","expired"].includes(detail.status) && <div className="mt-4 grid gap-2"><form action={expireAction} onSubmit={(event) => { if (!window.confirm("Esta acción expira el acceso de firma y no se puede revertir. ¿Continuar?")) event.preventDefault(); }}><input name="documentId" type="hidden" value={detail.id} /><button className="btn-secondary w-full" disabled={expirePending} type="submit">Marcar expirada si corresponde</button></form><form action={voidAction} className="grid gap-2" onSubmit={(event) => { if (!window.confirm("Anular revoca enlaces y sesiones. La solicitud no volverá al flujo de firma. ¿Continuar?")) event.preventDefault(); }}><input name="documentId" type="hidden" value={detail.id} /><label className="text-sm font-semibold">Razón de anulación<textarea className="mt-1 min-h-20 w-full rounded-lg border border-red-200 p-2 font-normal" maxLength={500} name="reason" required /></label><button className="w-full rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-800" disabled={voidPending} type="submit">Anular solicitud</button></form><Feedback state={expireState} /><Feedback state={voidState} /><Feedback state={resendState} /></div>}
        </section>

        {detail.status === "draft" && <section className="surface-card border border-red-200 p-5">
          <h2 className="text-lg font-semibold">Cerrar borrador</h2>
          <p className="mt-2 text-sm text-slate-600">Eliminar solo está permitido para un borrador inerte sin participantes, accesos, entregas, firmas, artefactos finales ni retención legal. La elegibilidad se valida nuevamente en el servidor.</p>
          <form action={deleteAction} className="mt-4 grid gap-3">
            <input name="documentId" type="hidden" value={detail.id} />
            <label className="text-sm font-semibold">Razón<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="reason" maxLength={500} required /></label>
            <label className="text-sm font-semibold">Escribe <code>ELIMINAR BORRADOR</code><input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="confirmationPhrase" required /></label>
            <p className="text-xs text-red-800">Se retirará el PDF fuente privado. El registro de auditoría de la eliminación permanecerá inmutable.</p>
            <button className="rounded-lg border border-red-300 px-3 py-2 font-semibold text-red-800" disabled={deletePending} type="submit">Eliminar borrador inerte</button>
            <Feedback state={deleteState} />
          </form>
          <form action={archiveAction} className="mt-5 grid gap-3 border-t pt-4">
            <input name="documentId" type="hidden" value={detail.id} />
            <label className="text-sm font-semibold">Razón para archivar<input className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" name="reason" maxLength={500} required /></label>
            <button className="btn-secondary" disabled={archivePending} type="submit">Archivar y preservar evidencia</button>
            <Feedback state={archiveState} />
          </form>
        </section>}
      </aside>
    </div>
  );
}

function FieldSettings({ detail, field }: { detail: SignatureDraftDetail; field: SignatureDraftDetail["fields"][number] }) {
  const [updateState, updateAction, updatePending] = useActionState(updateSignatureFieldAction, INITIAL);
  const [removeState, removeAction, removePending] = useActionState(removeSignatureFieldAction, INITIAL);
  return (
    <div className="rounded-xl border border-[#ddd] p-3">
      <form action={updateAction} className="space-y-2">
        <input name="documentId" type="hidden" value={detail.id} /><input name="fieldId" type="hidden" value={field.id} /><input name="fieldType" type="hidden" value={field.fieldType} /><input name="pageIndex" type="hidden" value={field.pageIndex} /><input name="x" type="hidden" value={field.normalizedX} /><input name="y" type="hidden" value={field.normalizedY} /><input name="width" type="hidden" value={field.normalizedWidth} /><input name="height" type="hidden" value={field.normalizedHeight} />
        <label className="block text-xs font-semibold">Etiqueta<input className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" maxLength={120} name="label" defaultValue={field.label} /></label>
        <label className="block text-xs font-semibold">Participante<select className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" name="participantId" defaultValue={field.participantId}>{detail.participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.name}</option>)}</select></label>
        <label className="flex items-center gap-2 text-sm"><input name="required" type="hidden" value="false" /><input name="required" type="checkbox" value="true" defaultChecked={field.required} /> Requerido</label>
        {field.fieldType === "text" && <label className="block text-xs font-semibold">Máximo de caracteres<input className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" max={500} min={1} name="maxLength" type="number" defaultValue={field.validationLimits.maxLength ?? 120} /></label>}
        <button className="text-sm font-semibold text-[#11518b]" disabled={updatePending} type="submit">Guardar propiedades</button>
        <Feedback state={updateState} />
      </form>
      <form action={removeAction} className="mt-2"><input name="documentId" type="hidden" value={detail.id} /><input name="fieldId" type="hidden" value={field.id} /><button className="text-sm font-semibold text-red-700" disabled={removePending} type="submit">Eliminar campo</button><Feedback state={removeState} /></form>
    </div>
  );
}
