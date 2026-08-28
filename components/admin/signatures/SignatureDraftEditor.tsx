"use client";
/* eslint-disable @next/next/no-img-element */

import {
  startTransition,
  useActionState,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import Link from "next/link";
import {
  IconCalendar,
  IconCalendarTime,
  IconCheckbox,
  IconCircleDot,
  IconChevronLeft,
  IconChevronRight,
  IconFileText,
  IconList,
  IconMail,
  IconNumber123,
  IconPlus,
  IconSignature,
  IconTextSize,
  IconPhone,
  IconUser,
  IconWritingSign,
  IconX,
} from "@tabler/icons-react";
import {
  addSignatureFieldAction,
  addSignatureParticipantAction,
  prepareSignatureSendAction,
  resendSignatureInvitationAction,
  removeSignatureFieldAction,
  updateSignatureFieldAction,
  updateSignatureParticipantAction,
  removeSignatureParticipantAction,
  removeSignatureRequestAction,
  saveSignatureTemplateAction,
  type SignatureAdminActionState,
} from "@/app/admin/signatures/actions";
import SignatureStepProgress from "./SignatureStepProgress";
import SignatureRoutingSummary from "./SignatureRoutingSummary";
import type { SignatureDraftDetail } from "@/lib/signatures/admin-repository";
import type { SignatureSendReadiness } from "@/lib/signatures/send-readiness";
import type { SignaturePreflightResult } from "@/lib/signatures/preflight";
import {
  evaluateSignatureVisualPreflight,
  type SignatureVisualPreflightIssue,
} from "@/lib/signatures/visual-preflight";
import { signatureDeliveryLabel } from "@/lib/signatures/admin-ux";
import { formatPuertoRicoDate, formatPuertoRicoDateTime } from "@/lib/puerto-rico-time";
import type { SignatureFieldType, SignatureFieldValidationLimits } from "@/lib/signatures/domain/types";
import { fieldChoiceOptions, fieldMaxLength, SIGNATURE_FIELD_LABELS } from "@/lib/signatures/field-options";

const INITIAL: SignatureAdminActionState = { ok: false, message: "" };
const COLORS = [
  "#11518b",
  "#8a5a00",
  "#6b3fa0",
  "#16704a",
  "#a33a3a",
  "#226e78",
  "#704214",
  "#565b66",
];
const FIELD_LABELS = SIGNATURE_FIELD_LABELS;
type FieldType = SignatureFieldType;
type Rect = { x: number; y: number; width: number; height: number };
const FIELD_ICONS = {
  signature: IconSignature,
  initials: IconWritingSign,
  date: IconCalendar,
  date_signed: IconCalendarTime,
  text: IconTextSize,
  checkbox: IconCheckbox,
  radio: IconCircleDot,
  dropdown: IconList,
  number: IconNumber123,
  email: IconMail,
  phone: IconPhone,
  signer_name: IconUser,
} as const;
const FIELD_GROUPS: readonly Readonly<{ label: string; fields: readonly FieldType[] }>[] = [
  { label: "Firma", fields: ["signature", "initials", "date_signed", "signer_name"] },
  { label: "Datos", fields: ["text", "date", "number", "email", "phone"] },
  { label: "Selección", fields: ["checkbox", "radio", "dropdown"] },
];
const READINESS_LABELS: Record<string, string> = {
  document_not_draft: "El documento ya no está en borrador.",
  active_version_missing: "Falta el PDF activo.",
  source_pdf_incompatible: "El PDF no pasó la validación.",
  version_already_locked: "La versión ya está cerrada para cambios.",
  expiration_invalid: "Selecciona una fecha de expiración válida.",
  event_keys_unavailable: "La configuración de evidencia no está disponible.",
  public_signing_disabled: "La activación de firma permanece deshabilitada.",
  document_classification_approval_missing:
    "Este tipo de documento todavía no ha sido aprobado para firma electrónica.",
  approved_consent_missing: "Falta aprobar el consentimiento es-PR.",
  retention_policy_missing:
    "Falta configurar y activar la política de retención.",
  privacy_disclosure_missing: "Falta aprobar la divulgación de privacidad.",
  participant_count_invalid: "Añade al menos un destinatario.",
  participant_email_invalid: "Revisa los correos de los destinatarios.",
  field_count_invalid: "Añade los campos requeridos.",
  required_participant_field_missing:
    "Cada destinatario necesita al menos un campo requerido.",
  field_definition_hash_stale:
    "Los campos cambiaron y deben revisarse nuevamente.",
  broker_final_signer_invalid:
    "Configura la corredora final y colócala en el último grupo.",
  correction_source_still_active:
    "Cancela la solicitud original antes de enviar esta corrección.",
};

function Feedback({ state }: { state: SignatureAdminActionState }) {
  return state.message ? (
    <p
      aria-live="polite"
      className={`mt-2 text-sm ${state.ok ? "text-green-700" : "text-red-700"}`}
    >
      {state.message}
    </p>
  ) : null;
}
function bounded(rect: Rect): Rect {
  const width = Math.min(Math.max(rect.width, 0.04), 1),
    height = Math.min(Math.max(rect.height, 0.025), 1);
  return {
    x: Math.min(Math.max(rect.x, 0), 1 - width),
    y: Math.min(Math.max(rect.y, 0), 1 - height),
    width,
    height,
  };
}
function defaultFieldSize(type: FieldType) {
  if (type === "checkbox") return { width: 0.04, height: 0.04 };
  if (type === "initials" || type === "date") return { width: 0.18, height: 0.07 };
  if (type === "radio") return { width: 0.22, height: 0.07 };
  return { width: 0.3, height: 0.07 };
}
function defaultValidation(type: FieldType): SignatureFieldValidationLimits {
  if (type === "radio" || type === "dropdown") return { options: ["Sí", "No"] };
  if (type === "number") return { allowDecimals: true };
  if (type === "text") return { maxLength: 120 };
  return {};
}
function appendFieldData(
  form: FormData,
  input: {
    documentId: string;
    participantId: string;
    fieldType: FieldType;
    pageIndex: number;
    rect: Rect;
    label?: string;
    required?: boolean;
    maxLength?: number;
    validationLimits?: SignatureFieldValidationLimits;
    fieldId?: string;
  },
) {
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
  const limits = input.validationLimits ?? {};
  form.set("options", fieldChoiceOptions(limits).join("\n"));
  form.set("allowDecimals", String(limits.allowDecimals !== false));
  if (typeof limits.min === "number") form.set("min", String(limits.min));
  if (typeof limits.max === "number") form.set("max", String(limits.max));
}

function FieldOverlay({
  documentId,
  field,
  color,
  ownerLabel,
  issueSeverity,
  selected,
  onSelect,
}: {
  documentId: string;
  field: SignatureDraftDetail["fields"][number];
  color: string;
  ownerLabel: string;
  issueSeverity?: "critical" | "warning";
  selected: boolean;
  onSelect: () => void;
}) {
  const [rect, setRect] = useState({
    x: field.normalizedX,
    y: field.normalizedY,
    width: field.normalizedWidth,
    height: field.normalizedHeight,
  });
  const [state, action, pending] = useActionState(
    updateSignatureFieldAction,
    INITIAL,
  );
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
      maxLength: fieldMaxLength(field.validationLimits, 120),
      validationLimits: field.validationLimits,
    });
    startTransition(() => action(form));
  }
  function begin(
    event: ReactPointerEvent<HTMLButtonElement>,
    mode: "move" | "resize",
  ) {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    const target = event.currentTarget,
      origin = { x: event.clientX, y: event.clientY, rect };
    target.setPointerCapture(event.pointerId);
    const next = (pointer: PointerEvent) => {
      const scale = Math.max(
          target.parentElement?.parentElement?.getBoundingClientRect().width ??
            1,
          1,
        ),
        dx = (pointer.clientX - origin.x) / scale,
        dy = (pointer.clientY - origin.y) / scale;
      return bounded(
        mode === "move"
          ? { ...origin.rect, x: origin.rect.x + dx, y: origin.rect.y + dy }
          : {
              ...origin.rect,
              width: origin.rect.width + dx,
              height: origin.rect.height + dy,
            },
      );
    };
    function move(pointer: PointerEvent) {
      setRect(next(pointer));
    }
    function end(pointer: PointerEvent) {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", end);
      const value = next(pointer);
      setRect(value);
      persist(value);
    }
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", end);
  }
  function keyboard(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? 0.01 : 0.002,
      delta =
        event.key === "ArrowLeft"
          ? [-step, 0]
          : event.key === "ArrowRight"
            ? [step, 0]
            : event.key === "ArrowUp"
              ? [0, -step]
              : event.key === "ArrowDown"
                ? [0, step]
                : null;
    if (!delta) return;
    event.preventDefault();
    const next = bounded({
      ...rect,
      x: rect.x + delta[0],
      y: rect.y + delta[1],
    });
    setRect(next);
    persist(next);
  }
  return (
    <div
      id={`signature-field-${field.id}`}
      className="absolute touch-none"
      data-preflight-severity={issueSeverity}
      data-selected={selected}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.width * 100}%`,
        height: `${rect.height * 100}%`,
        zIndex: selected ? 20 : 10,
      }}
    >
      <button
        aria-label={`Mover ${field.label}. Propietario: ${ownerLabel}. Página ${field.pageIndex + 1}${issueSeverity ? `. ${issueSeverity === "critical" ? "Problema crítico" : "Advertencia"}` : ""}`}
        className={`signature-field-overlay ${selected ? "is-selected" : ""} ${issueSeverity === "critical" ? "is-critical" : issueSeverity === "warning" ? "is-warning" : ""}`}
        disabled={pending}
        onFocus={onSelect}
        onKeyDown={keyboard}
        onPointerDown={(event) => begin(event, "move")}
        style={issueSeverity ? undefined : { borderColor: color, color }}
        type="button"
      >
        <span>{FIELD_LABELS[field.fieldType]}</span>
        <span className="max-w-full truncate font-normal">{ownerLabel}</span>
      </button>
      <button
        aria-label={`Redimensionar ${field.label} de ${ownerLabel}`}
        className="signature-field-resize"
        onPointerDown={(event) => begin(event, "resize")}
        style={{
          backgroundColor:
            issueSeverity === "critical"
              ? "#dc2626"
              : issueSeverity === "warning"
                ? "#d97706"
                : color,
        }}
        type="button"
      />
      <span className="sr-only" aria-live="polite">
        {state.message}
      </span>
    </div>
  );
}

export default function SignatureDraftEditor({
  detail,
  readiness,
  preflight,
  activationMode,
}: {
  detail: SignatureDraftDetail;
  readiness: SignatureSendReadiness;
  preflight: SignaturePreflightResult;
  activationMode: "public" | "internal_canary" | "disabled";
}) {
  const editable = detail.status === "draft" && !detail.version.locked;
  const [step, setStep] = useState(
    editable ? (detail.participants.length ? 3 : 2) : 4,
  );
  const [pageIndex, setPageIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [selectedParticipantId, setParticipantId] = useState(
    detail.participants[0]?.id ?? "",
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [participantState, participantAction, participantPending] =
    useActionState(addSignatureParticipantAction, INITIAL);
  const [fieldState, fieldAction, fieldPending] = useActionState(
    addSignatureFieldAction,
    INITIAL,
  );
  const [sendState, sendAction, sendPending] = useActionState(
    prepareSignatureSendAction,
    INITIAL,
  );
  const [, resendAction, resendPending] = useActionState(
    resendSignatureInvitationAction,
    INITIAL,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeSignatureRequestAction,
    INITIAL,
  );
  const [templateState, templateAction, templatePending] = useActionState(
    saveSignatureTemplateAction,
    INITIAL,
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const participantId = detail.participants.some(
    (participant) => participant.id === selectedParticipantId,
  )
    ? selectedParticipantId
    : (detail.participants[0]?.id ?? "");
  function createField(fieldType: FieldType, rect: Rect) {
    if (!participantId) return;
    const form = new FormData();
    appendFieldData(form, {
      documentId: detail.id,
      participantId,
      fieldType,
      pageIndex,
      rect: bounded(rect),
      validationLimits: defaultValidation(fieldType),
    });
    startTransition(() => fieldAction(form));
  }
  function drop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const type = event.dataTransfer.getData(
      "application/x-borikipr-signature-field",
    ) as FieldType;
    if (!FIELD_LABELS[type] || !canvasRef.current) return;
    const b = canvasRef.current.getBoundingClientRect(),
      size = defaultFieldSize(type);
    createField(type, {
      x: (event.clientX - b.left) / b.width - size.width / 2,
      y: (event.clientY - b.top) / b.height - size.height / 2,
      ...size,
    });
  }
  const colors = new Map(
    detail.participants.map((p, i) => [p.id, COLORS[i % COLORS.length]]),
  );
  const pageFields = detail.fields.filter((f) => f.pageIndex === pageIndex);
  const geometry = detail.version.pageGeometry[pageIndex];
  const rotated = geometry?.rotation === 90 || geometry?.rotation === 270;
  const width = rotated ? geometry?.cropBox.height : geometry?.cropBox.width,
    height = rotated ? geometry?.cropBox.width : geometry?.cropBox.height;
  const required = detail.fields.filter((field) => field.required).length,
    likelyInert =
      detail.status === "draft" &&
      detail.participants.length === 0 &&
      detail.fields.length === 0;
  const visualPreflight = evaluateSignatureVisualPreflight(
    detail.fields,
    detail.version.pageGeometry,
  );
  const fieldIssueSeverity = new Map<string, "critical" | "warning">();
  visualPreflight.issues.forEach((issue) =>
    issue.fieldIds.forEach((fieldId) => {
      if (issue.severity === "critical" || !fieldIssueSeverity.has(fieldId))
        fieldIssueSeverity.set(fieldId, issue.severity);
    }),
  );
  function jumpToIssue(issue: SignatureVisualPreflightIssue) {
    setStep(3);
    setPageIndex(issue.pageIndex);
    setSelectedFieldId(issue.fieldIds[0]);
    window.setTimeout(
      () =>
        document
          .getElementById(`signature-field-${issue.fieldIds[0]}`)
          ?.querySelector("button")
          ?.focus(),
      50,
    );
  }

  return (
    <div
      className={`signature-editor min-w-0 space-y-4 ${step === 3 ? "is-field-step" : ""}`}
    >
      <SignatureStepProgress current={step} />
      <div className="signature-step-tabs" aria-label="Cambiar paso">
        {[2, 3, 4, 5].map((number) => (
          <button
            key={number}
            className={step === number ? "is-active" : ""}
            onClick={() => setStep(number)}
            type="button"
          >
            {number === 2
              ? "Destinatarios"
              : number === 3
                ? "Campos"
                : number === 4
                  ? "Revisar"
                  : "Enviar"}
          </button>
        ))}
      </div>

      {step === 2 && (
        <section className="signature-workflow-panel" id="destinatarios">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h2 className="text-xl font-semibold">2. Destinatarios</h2>
              <p className="mt-1 text-sm text-slate-600">
                {detail.routingMode === "parallel"
                  ? "Los destinatarios firman al mismo tiempo."
                  : detail.routingMode === "sequential"
                    ? "Cada persona firma después de que termine la anterior."
                    : "Quienes están en la misma etapa firman a la vez; la etapa siguiente espera."}{" "}
                {detail.requiresBrokerSignature &&
                  "La corredora configurada firma al final."}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
              {detail.participants.length}/8
            </span>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {detail.participants.map((participant, index) => (
              <RecipientCard
                key={participant.id}
                detail={detail}
                participant={participant}
                color={COLORS[index % COLORS.length]}
                resendAction={resendAction}
                resendPending={resendPending}
              />
            ))}
          </div>
          <div className="mt-5">
            <SignatureRoutingSummary
              compact
              mode={detail.routingMode}
              participants={detail.participants}
            />
          </div>
          {editable && (
            <form
              action={participantAction}
              className="signature-recipient-add-form mt-6 grid gap-4 sm:grid-cols-2"
            >
              <h3 className="text-lg font-semibold sm:col-span-2">
                Añadir destinatario
              </h3>
              <label>
                <span className="text-sm font-semibold">Nombre</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-3"
                  name="name"
                  required
                />
              </label>
              <label>
                <span className="text-sm font-semibold">Correo</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-3"
                  name="email"
                  type="email"
                  required
                />
              </label>
              <label>
                <span className="text-sm font-semibold">Rol</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-3"
                  name="role"
                  placeholder="Comprador, Vendedor, Arrendador…"
                  required
                />
              </label>
              <label>
                <span className="text-sm font-semibold">Grupo de firma</span>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-3"
                  name="routingOrder"
                  type="number"
                  min={1}
                  max={8}
                  defaultValue={
                    detail.routingMode === "parallel" ? 1 : undefined
                  }
                />
                <span className="mt-1 block text-xs text-slate-500">
                  Mismo número = firman a la vez. Número siguiente = espera.
                </span>
              </label>
              <input name="documentId" type="hidden" value={detail.id} />
              <button
                className="btn-primary sm:col-span-2 sm:justify-self-start"
                disabled={participantPending || detail.participants.length >= 8}
                type="submit"
              >
                Añadir destinatario
              </button>
              <div className="sm:col-span-2">
                <Feedback state={participantState} />
              </div>
            </form>
          )}
        </section>
      )}

      {step === 3 && (
        <section className="signature-field-editor-layout">
          <header className="signature-editor-application-bar">
            <button
              aria-label="Volver a destinatarios"
              className="signature-toolbar-icon"
              onClick={() => setStep(2)}
              type="button"
            >
              <IconChevronLeft aria-hidden="true" size={20} />
            </button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-950">
                {detail.title}
              </p>
              <p className="text-xs text-slate-500">Preparación · Campos</p>
            </div>
            <div className="hidden items-center gap-2 text-xs font-semibold text-slate-600 sm:flex">
              <span>{detail.fields.length}/100 campos</span>
              <span aria-hidden="true">·</span>
              <span>Página {pageIndex + 1} de {detail.version.pageCount}</span>
            </div>
            <button
              className="btn-primary"
              onClick={() => setStep(4)}
              type="button"
            >
              Revisar
            </button>
          </header>
          <aside
            className={`signature-field-palette ${mobileToolsOpen ? "is-open" : ""}`}
            aria-label="Herramientas de campos"
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.08em] text-slate-500">
                  Herramientas
                </p>
                <h2 className="mt-1 text-lg font-semibold">Añadir campos</h2>
              </div>
              <button
                aria-label="Cerrar herramientas"
                className="signature-mobile-sheet-close"
                onClick={() => setMobileToolsOpen(false)}
                type="button"
              >
                <IconX aria-hidden="true" size={20} />
              </button>
            </div>
            <div className="signature-owner-context">
              <label className="block text-xs font-bold uppercase tracking-[.08em] text-slate-500">
                Campos para
                <span className="mt-2 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{
                      backgroundColor:
                        colors.get(participantId) ?? COLORS[0],
                    }}
                  />
                  <select
                    className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm font-semibold normal-case tracking-normal"
                    value={participantId}
                    onChange={(event) => setParticipantId(event.target.value)}
                  >
                    <option value="">Añade un destinatario</option>
                    {detail.participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.role} · {p.name}
                        {p.isBrokerFinalSigner ? " · Firma final" : ""}
                      </option>
                    ))}
                  </select>
                </span>
              </label>
            </div>
            <div className="signature-field-tools">
              {FIELD_GROUPS.map((group) => (
                <div className="contents" key={group.label}>
                  <p className="signature-field-tool-group">{group.label}</p>
                  {group.fields.map((type) => {
                    const FieldIcon = FIELD_ICONS[type];
                    return (
                      <button
                        className="signature-field-tool"
                        disabled={!editable || !participantId || fieldPending}
                        draggable
                        onClick={() => {
                          const size = defaultFieldSize(type);
                          createField(type, { x: 0.35, y: 0.45, ...size });
                          setMobileToolsOpen(false);
                        }}
                        onDragStart={(e) => e.dataTransfer.setData("application/x-borikipr-signature-field", type)}
                        key={type}
                        type="button"
                      >
                        <FieldIcon aria-hidden="true" size={20} />
                        <span>{FIELD_LABELS[type]}</span>
                        <IconPlus aria-hidden="true" className="ml-auto text-slate-400" size={17} />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            <Feedback state={fieldState} />
          </aside>
          {mobileToolsOpen && (
            <button
              aria-label="Cerrar herramientas"
              className="signature-mobile-sheet-backdrop"
              onClick={() => setMobileToolsOpen(false)}
              type="button"
            />
          )}
          <div className="signature-document-workspace">
            <div className="signature-document-toolbar">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.08em] text-slate-500">
                  Preparar documento
                </p>
                <h2 className="text-lg font-semibold">Coloca los campos</h2>
                <p className="hidden text-sm text-slate-600 sm:block">
                  Toca para añadir o arrastra en escritorio.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  className="signature-mobile-tools-button"
                  onClick={() => setMobileToolsOpen(true)}
                  type="button"
                >
                  <IconFileText aria-hidden="true" size={18} /> Campos
                </button>
                <button
                  aria-label="Página anterior"
                  className="signature-toolbar-icon"
                  disabled={pageIndex === 0}
                  onClick={() => setPageIndex((v) => v - 1)}
                  type="button"
                >
                  <IconChevronLeft aria-hidden="true" size={19} />
                </button>
                <label className="text-sm font-semibold">
                  <span className="sr-only">Página</span>
                  <select
                    className="rounded-lg border px-2 py-2 text-sm"
                    value={pageIndex}
                    onChange={(e) => setPageIndex(Number(e.target.value))}
                  >
                    {Array.from(
                      { length: detail.version.pageCount },
                      (_, i) => (
                        <option key={i} value={i}>
                          Página {i + 1}
                        </option>
                      ),
                    )}
                  </select>
                </label>
                <button
                  aria-label="Página siguiente"
                  className="signature-toolbar-icon"
                  disabled={pageIndex + 1 >= detail.version.pageCount}
                  onClick={() => setPageIndex((v) => v + 1)}
                  type="button"
                >
                  <IconChevronRight aria-hidden="true" size={19} />
                </button>
                <label className="text-sm font-semibold">
                  <span className="sr-only">Zoom</span>
                  <select
                    className="rounded-lg border px-2 py-2"
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  >
                    <option value={0.75}>75%</option>
                    <option value={1}>100%</option>
                    <option value={1.25}>125%</option>
                    <option value={1.5}>150%</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="signature-document-canvas-scroll overflow-auto">
              <div
                className="mx-auto origin-top"
                style={{ width: `${zoom * 100}%`, maxWidth: `${zoom * 900}px` }}
              >
                <div
                  ref={canvasRef}
                  aria-label={`Página ${pageIndex + 1} del PDF`}
                  className="signature-document-canvas relative w-full bg-white"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={drop}
                  style={{ aspectRatio: `${width ?? 612}/${height ?? 792}` }}
                >
                  <img
                    alt={`Vista previa de la página ${pageIndex + 1}`}
                    className="h-full w-full object-contain"
                    draggable={false}
                    src={`/admin/signatures/${detail.id}/pages/${pageIndex}`}
                  />
                  {pageFields.map((field) => {
                    const owner = detail.participants.find(
                      (item) => item.id === field.participantId,
                    );
                    return (
                      <FieldOverlay
                        key={field.id}
                        documentId={detail.id}
                        field={field}
                        color={colors.get(field.participantId) ?? COLORS[0]}
                        ownerLabel={
                          owner
                            ? `${owner.role} · ${owner.name}`
                            : "Sin propietario"
                        }
                        issueSeverity={fieldIssueSeverity.get(field.id)}
                        selected={selectedFieldId === field.id}
                        onSelect={() => setSelectedFieldId(field.id)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          {selectedFieldId ? (
            <button
              aria-label="Cerrar propiedades del campo"
              className="signature-mobile-properties-backdrop"
              onClick={() => setSelectedFieldId(null)}
              type="button"
            />
          ) : null}
          <aside
            className={`signature-field-properties ${selectedFieldId ? "has-selection" : ""}`}
          >
            <section className="signature-properties-section">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.08em] text-slate-500">
                    Documento
                  </p>
                  <h2 className="font-semibold">Propiedades del campo</h2>
                </div>
                {selectedFieldId ? (
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-semibold text-[#11518b]">
                      Seleccionado
                    </span>
                    <button
                      aria-label="Cerrar propiedades del campo"
                      className="signature-mobile-properties-close"
                      onClick={() => setSelectedFieldId(null)}
                      type="button"
                    >
                      <IconX aria-hidden="true" size={18} />
                    </button>
                  </div>
                ) : null}
              </div>
              <div className="mt-4 space-y-3">
                {selectedFieldId ? (
                  detail.fields
                    .filter((field) => field.id === selectedFieldId)
                    .map((field) => (
                      <FieldSettings
                        key={field.id}
                        detail={detail}
                        field={field}
                        editable={editable}
                        selected
                        onSelect={() => setPageIndex(field.pageIndex)}
                      />
                    ))
                ) : (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                    Selecciona un campo en el PDF para editar su propietario,
                    etiqueta y requisito.
                  </p>
                )}
              </div>
            </section>
            <section className="signature-properties-section" aria-labelledby="todos-los-campos">
              <div className="flex items-center justify-between gap-2 text-sm font-semibold">
                <span id="todos-los-campos">Todos los campos ({detail.fields.length})</span>
                <IconPlus aria-hidden="true" className="text-slate-400" size={17} />
              </div>
              <div className="mt-3 space-y-2">
                {detail.fields.map((field) => (
                  <button
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-left text-xs hover:border-[#11518b] hover:bg-blue-50"
                    key={field.id}
                    onClick={() => {
                      setSelectedFieldId(field.id);
                      setPageIndex(field.pageIndex);
                    }}
                    type="button"
                  >
                    <span className="block font-semibold">{FIELD_LABELS[field.fieldType]} · Página {field.pageIndex + 1}</span>
                    <span className="mt-0.5 block truncate text-slate-500">{field.label}</span>
                  </button>
                ))}
                {!detail.fields.length ? (
                  <p className="text-sm text-slate-500">Aún no hay campos.</p>
                ) : null}
              </div>
            </section>
            <VisualPreflightPanel
              preflight={visualPreflight}
              onIssue={jumpToIssue}
            />
          </aside>
        </section>
      )}

      {step === 4 && (
        <section className="signature-review-layout">
          <div className="signature-workflow-panel">
            <p className="text-xs font-bold uppercase tracking-[.08em] text-[#11518b]">
              Revisión final
            </p>
            <h2 className="mt-1 text-2xl font-semibold">
              Confirma la solicitud
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Verifica el documento, sus firmantes y la ruta antes de continuar
              al envío.
            </p>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2">
              <Summary
                label="Documento"
                value={`${detail.title} · ${detail.version.pageCount} páginas`}
              />
              <Summary
                label="Expiración"
                value={
                  detail.expiresAt
                    ? formatPuertoRicoDate(detail.expiresAt)
                    : "Pendiente"
                }
              />
              <Summary
                label="Destinatarios"
                value={`${detail.participants.length} añadidos`}
              />
              <Summary
                label="Campos"
                value={`${detail.fields.length} totales · ${required} requeridos`}
              />
              <Summary label="Idioma" value="Español (Puerto Rico)" />
              <Summary
                label="Estado"
                value={
                  readiness.eligible && !visualPreflight.sendBlocked
                    ? "Listo"
                    : "Bloqueado"
                }
              />
            </dl>
            <div className="mt-5">
              <SignatureRoutingSummary
                compact
                mode={detail.routingMode}
                participants={detail.participants}
              />
            </div>
          </div>
          <div className="grid content-start gap-5">
            <VisualPreflightPanel
              preflight={visualPreflight}
              onIssue={jumpToIssue}
            />
            <ReadinessCard readiness={readiness} />
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="signature-review-layout">
          <div className="signature-workflow-panel">
            <p className="text-xs font-bold uppercase tracking-[.08em] text-[#11518b]">
              Último paso
            </p>
            <h2 className="mt-1 text-2xl font-semibold">Enviar para firma</h2>
            <p
              className={`mt-3 rounded-xl border p-3 text-sm font-semibold ${activationMode === "internal_canary" ? "border-amber-300 bg-amber-50 text-amber-900" : activationMode === "public" ? "border-red-300 bg-red-50 text-red-900" : "border-slate-300 bg-slate-50 text-slate-700"}`}
            >
              {activationMode === "internal_canary"
                ? "CANARY INTERNO — prueba controlada, no envío público"
                : activationMode === "public"
                  ? "ENVÍO A CLIENTE"
                  : "Firma desactivada"}
            </p>
            <form action={sendAction} className="mt-4 grid gap-3">
              <input name="documentId" type="hidden" value={detail.id} />
              <input
                name="documentType"
                type="hidden"
                value={detail.documentType}
              />
              <p className="text-sm text-slate-600">
                {detail.title} · {detail.participants.length} destinatarios ·
                es-PR · expira{" "}
                {detail.expiresAt
                  ? formatPuertoRicoDate(detail.expiresAt)
                  : "sin fecha"}
              </p>
              <label className="flex items-start gap-3 text-sm">
                <input
                  className="mt-1"
                  name="sendAcknowledged"
                  type="checkbox"
                  value="true"
                  required
                />
                <span>
                  Revisé el documento, destinatarios, campos, idioma, ruta y
                  expiración.
                </span>
              </label>
              <label className="text-sm font-semibold">
                Escribe{" "}
                <code>
                  {activationMode === "public"
                    ? "CONFIRMAR ENVIO PUBLICO"
                    : "CONFIRMAR ENVIO CANARY INTERNO"}
                </code>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-3 font-normal"
                  name="sendConfirmationPhrase"
                  required
                />
              </label>
              <button
                className="btn-primary w-full disabled:opacity-60"
                disabled={
                  sendPending ||
                  !readiness.eligible ||
                  visualPreflight.sendBlocked ||
                  activationMode === "disabled"
                }
                type="submit"
              >
                {readiness.eligible &&
                !visualPreflight.sendBlocked &&
                activationMode !== "disabled"
                  ? "Enviar para firma"
                  : "Envío bloqueado"}
              </button>
              <Feedback state={sendState} />
            </form>
          </div>
          <div className="grid content-start gap-5">
            <SignatureRoutingSummary
              compact
              mode={detail.routingMode}
              participants={detail.participants}
            />
            <VisualPreflightPanel
              preflight={visualPreflight}
              onIssue={jumpToIssue}
            />
            <ReadinessCard readiness={readiness} />
          </div>
        </section>
      )}

      {detail.participants.length > 0 && detail.fields.length > 0 && (
        <section className="surface-card p-5" aria-labelledby="guardar-plantilla">
          <h2 id="guardar-plantilla" className="font-semibold">Guardar como plantilla</h2>
          <p className="mt-2 text-sm text-slate-600">
            Conserva el PDF, roles, campos y ruta. Nunca copia personas, firmas,
            valores, tokens ni sesiones.
          </p>
          <form action={templateAction} className="mt-4 grid max-w-xl gap-3">
            <input name="documentId" type="hidden" value={detail.id} />
            <label className="text-sm font-semibold">
              Nombre de plantilla
              <input
                className="mt-1 w-full rounded-lg border px-3 py-3 font-normal"
                name="name"
                defaultValue={detail.title}
                required
              />
            </label>
            <label className="text-sm font-semibold">
              Descripción opcional
              <textarea
                className="mt-1 w-full rounded-lg border px-3 py-3 font-normal"
                name="description"
                maxLength={500}
              />
            </label>
            <fieldset className="grid gap-2 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm font-semibold">
                Roles opcionales
              </legend>
              <p className="text-xs text-slate-600">
                Al usar la plantilla, un rol opcional puede dejarse
                completamente vacío.
              </p>
              {detail.participants
                .filter((participant) => !participant.isBrokerFinalSigner)
                .map((participant) => (
                  <label
                    className="flex items-center gap-2 text-sm"
                    key={participant.id}
                  >
                    <input
                      name="optionalParticipantId"
                      type="checkbox"
                      value={participant.id}
                    />
                    <span>{participant.role}</span>
                  </label>
                ))}
            </fieldset>
            <button
              className="btn-secondary justify-self-start"
              disabled={templatePending}
              type="submit"
            >
              Guardar plantilla
            </button>
            <Feedback state={templateState} />
          </form>
        </section>
      )}

      <section className="surface-card border border-red-200 p-5" aria-labelledby="eliminar-solicitud">
          <h2 id="eliminar-solicitud" className="font-semibold text-red-800">Eliminar solicitud</h2>
          <p className="mt-3 text-sm text-slate-600">
            Borikí decidirá el tratamiento seguro. Si existe actividad, la
            solicitud saldrá de tu lista activa pero la evidencia necesaria
            permanecerá protegida.
          </p>
          <form action={removeAction} className="mt-4 grid gap-3">
            <input name="documentId" type="hidden" value={detail.id} />
            <label className="text-sm font-semibold">
              Razón
              <input
                className="mt-1 w-full rounded-lg border px-3 py-3 font-normal"
                name="reason"
                maxLength={500}
                required
              />
            </label>
            {likelyInert && (
              <label className="text-sm font-semibold">
                Escribe <code>ELIMINAR BORRADOR</code>
                <input
                  className="mt-1 w-full rounded-lg border px-3 py-3 font-normal"
                  name="confirmationPhrase"
                  required
                />
              </label>
            )}
            <button
              className="rounded-lg border border-red-300 px-4 py-3 font-semibold text-red-800"
              disabled={removePending}
              type="submit"
            >
              {likelyInert
                ? "Eliminar este borrador"
                : "Quitar de solicitudes activas"}
            </button>
            <Feedback state={removeState} />
          </form>
      </section>

      <div
        className="sticky bottom-0 z-30 flex items-center justify-between gap-3 border-t bg-white/95 px-3 py-3 shadow-[0_-8px_30px_rgba(0,0,0,.08)] backdrop-blur"
        style={{ paddingBottom: "max(.75rem,env(safe-area-inset-bottom))" }}
      >
        <button
          className="btn-secondary"
          disabled={step <= 2}
          onClick={() => setStep((value) => Math.max(2, value - 1))}
          type="button"
        >
          Atrás
        </button>
        <span className="text-sm font-semibold">Paso {step} de 5</span>
        <button
          className="btn-primary"
          disabled={step >= 5 || (step === 2 && !detail.participants.length)}
          onClick={() => setStep((value) => Math.min(5, value + 1))}
          type="button"
        >
          {step === 4
            ? "Continuar al envío"
            : step === 3
              ? "Revisar"
              : "Siguiente"}
        </button>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-slate-600">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
function VisualPreflightPanel({
  preflight,
  onIssue,
}: {
  preflight: ReturnType<typeof evaluateSignatureVisualPreflight>;
  onIssue: (issue: SignatureVisualPreflightIssue) => void;
}) {
  return (
    <section
      className={`signature-preflight-panel ${preflight.sendBlocked ? "is-blocked" : preflight.warningCount ? "has-warnings" : "is-ready"}`}
      aria-labelledby="visual-preflight-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="visual-preflight-heading" className="font-semibold">
          {preflight.sendBlocked
            ? preflight.criticalCount === 1
              ? "Hay un problema que debes corregir"
              : `Hay ${preflight.criticalCount} problemas que debes corregir`
            : preflight.warningCount
              ? `${preflight.warningCount} ${preflight.warningCount === 1 ? "advertencia" : "advertencias"} para revisar`
              : "Todo listo para enviar"}
        </h2>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${preflight.sendBlocked ? "bg-red-100 text-red-800" : preflight.warningCount ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-800"}`}
        >
          {preflight.sendBlocked
            ? `${preflight.criticalCount} críticos`
            : preflight.warningCount
              ? `${preflight.warningCount} advertencias`
              : "Sin problemas"}
        </span>
      </div>
      {!preflight.issues.length ? (
        <p className="mt-2 text-sm text-slate-600">
          Los campos tienen espacio suficiente y permanecen dentro de sus
          páginas.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-slate-600">
            Los problemas críticos bloquean el envío. Las advertencias requieren
            revisión visual.
          </p>
          <ul className="mt-3 grid gap-2">
            {preflight.issues.map((issue) => (
              <li key={issue.id}>
                <button
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm focus:ring-2 focus:ring-[#11518b] ${issue.severity === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-950"}`}
                  onClick={() => onIssue(issue)}
                  type="button"
                >
                  <span className="font-semibold">
                    Página {issue.pageIndex + 1} · Ir al campo
                  </span>
                  <span className="mt-0.5 block">{issue.message}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
function ReadinessCard({
  readiness,
}: {
  readiness: SignatureSendReadiness;
}) {
  return (
    <section className="surface-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Preparación para enviar</h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${readiness.eligible ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
        >
          {readiness.eligible ? "LISTO" : "BLOQUEADO"}
        </span>
      </div>
      {!readiness.eligible && (
        <>
          <p className="mt-3 text-sm text-slate-600">
            Completa lo siguiente antes de enviar:
          </p>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
            {readiness.reasons.map((reason) => (
              <li key={reason}>
                {READINESS_LABELS[reason] ??
                  "Hay un control pendiente que requiere revisión."}
              </li>
            ))}
          </ul>
          <Link
            className="mt-4 inline-flex font-semibold text-[#11518b] hover:underline"
            href="/admin/signatures/configuracion"
          >
            Abrir Configuración de Firmas
          </Link>
        </>
      )}
    </section>
  );
}

function RecipientCard({
  detail,
  participant,
  color,
  resendAction,
  resendPending,
}: {
  detail: SignatureDraftDetail;
  participant: SignatureDraftDetail["participants"][number];
  color: string;
  resendAction: (payload: FormData) => void;
  resendPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [updateState, updateAction, updatePending] = useActionState(
    updateSignatureParticipantAction,
    INITIAL,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeSignatureParticipantAction,
    INITIAL,
  );
  const editable = detail.status === "draft" && !detail.version.locked;
  return (
    <article
      className="signature-recipient-card"
      style={{ borderLeftColor: color, borderLeftWidth: 5 }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-words font-semibold">{participant.name}</h3>
            {participant.isBrokerFinalSigner && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900">
                Corredora · Firma final
              </span>
            )}
          </div>
          <p className="break-all text-sm text-slate-600">
            {participant.email}
          </p>
          <p className="mt-1 text-sm">
            {participant.role}
            {participant.routingOrder
              ? ` · Etapa ${participant.routingOrder}`
              : ""}
          </p>
          {participant.lastDeliveryStatus ? (
            <p className="mt-2 text-xs text-slate-600">
              {signatureDeliveryLabel(participant.lastDeliveryStatus)}
              {participant.lastDeliveryAt
                ? ` · ${formatPuertoRicoDateTime(participant.lastDeliveryAt)}`
                : ""}
            </p>
          ) : null}
        </div>
        {editable && !participant.isBrokerFinalSigner && (
          <button
            className="text-sm font-semibold text-[#11518b]"
            onClick={() => setEditing((value) => !value)}
            type="button"
          >
            {editing ? "Cerrar" : "Editar"}
          </button>
        )}
      </div>
      {editing && (
        <form action={updateAction} className="mt-4 grid gap-3">
          <input name="documentId" type="hidden" value={detail.id} />
          <input name="participantId" type="hidden" value={participant.id} />
          <label className="text-sm font-semibold">
            Nombre
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              name="name"
              defaultValue={participant.name}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Correo
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              name="email"
              defaultValue={participant.email}
              type="email"
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Rol
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              name="role"
              defaultValue={participant.role}
              required
            />
          </label>
          <label className="text-sm font-semibold">
            Orden de visualización
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              name="routingOrder"
              defaultValue={participant.routingOrder ?? ""}
              type="number"
              min={1}
              max={8}
            />
          </label>
          <button
            className="btn-secondary"
            disabled={updatePending}
            type="submit"
          >
            Guardar
          </button>
          <Feedback state={updateState} />
        </form>
      )}
      {editable && !participant.isBrokerFinalSigner && (
        <form action={removeAction} className="mt-3">
          <input name="documentId" type="hidden" value={detail.id} />
          <input name="participantId" type="hidden" value={participant.id} />
          <input
            name="reason"
            type="hidden"
            value="Eliminado por el operador durante la preparación"
          />
          <button
            className="text-sm font-semibold text-red-700"
            disabled={removePending}
            type="submit"
          >
            Eliminar destinatario
          </button>
          <Feedback state={removeState} />
        </form>
      )}
      {["invited", "viewed", "consented"].includes(participant.status) && (
        <section className="mt-4 border-t border-slate-200 pt-3" aria-labelledby={`opciones-contacto-${participant.id}`}>
          <h3 id={`opciones-contacto-${participant.id}`} className="text-sm font-semibold text-[#11518b]">Opciones de contacto</h3>
          <div className="mt-3 grid gap-3">
            <div>
              <p className="text-sm font-semibold">Reenviar invitación</p>
              <p className="text-xs leading-5 text-slate-600">
                Envía una nueva invitación y reemplaza el acceso anterior cuando
                corresponde.
              </p>
              <form action={resendAction} className="mt-2">
                <input name="documentId" type="hidden" value={detail.id} />
                <input
                  name="participantId"
                  type="hidden"
                  value={participant.id}
                />
                <button
                  className="btn-secondary"
                  disabled={resendPending}
                  type="submit"
                >
                  Reenviar invitación
                </button>
              </form>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="text-sm font-semibold">Recordar</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                Un recordatorio conserva el acceso actual. Todavía no está
                configurado; Borikí no enviará correos adicionales sin una
                acción segura y auditable.
              </p>
            </div>
          </div>
        </section>
      )}
    </article>
  );
}

function FieldSettings({
  detail,
  field,
  editable,
  selected,
  onSelect,
}: {
  detail: SignatureDraftDetail;
  field: SignatureDraftDetail["fields"][number];
  editable: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateSignatureFieldAction,
    INITIAL,
  );
  const [removeState, removeAction, removePending] = useActionState(
    removeSignatureFieldAction,
    INITIAL,
  );
  const owner = detail.participants.find(
    (participant) => participant.id === field.participantId,
  );
  return (
    <div
      className={`signature-field-list-item ${selected ? "is-selected" : ""}`}
      onFocus={onSelect}
    >
      <button
        className={`${selected ? "mb-3" : ""} w-full text-left`}
        onClick={onSelect}
        type="button"
      >
        <span className="block text-sm font-semibold">
          {FIELD_LABELS[field.fieldType]} · Página {field.pageIndex + 1}
        </span>
        <span className="mt-1 block text-xs text-slate-600">
          {owner ? `${owner.role} · ${owner.name}` : "Sin propietario"} ·{" "}
          {field.required ? "Requerido" : "Opcional"}
          {owner?.routingOrder ? ` · Etapa ${owner.routingOrder}` : ""}
        </span>
      </button>
      {selected && (
        <form
          action={updateAction}
          className="space-y-2 border-t border-slate-200 pt-3"
        >
          <input name="documentId" type="hidden" value={detail.id} />
          <input name="fieldId" type="hidden" value={field.id} />
          <input name="fieldType" type="hidden" value={field.fieldType} />
          <input name="pageIndex" type="hidden" value={field.pageIndex} />
          <input name="x" type="hidden" value={field.normalizedX} />
          <input name="y" type="hidden" value={field.normalizedY} />
          <input name="width" type="hidden" value={field.normalizedWidth} />
          <input name="height" type="hidden" value={field.normalizedHeight} />
          <label className="block text-xs font-semibold">
            Etiqueta
            <input
              className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
              name="label"
              defaultValue={field.label}
            />
          </label>
          <label className="block text-xs font-semibold">
            Propietario
            <select
              className="mt-1 w-full rounded-lg border px-2 py-2 text-sm"
              name="participantId"
              defaultValue={field.participantId}
            >
              {detail.participants.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.role} · {p.name}
                  {p.isBrokerFinalSigner ? " · Firma final" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="required" type="hidden" value="false" />
            <input
              name="required"
              type="checkbox"
              value="true"
              defaultChecked={field.required}
            />{" "}
            Requerido
          </label>
          {field.fieldType === "text" && (
            <label className="block text-xs font-semibold">
              Máximo de caracteres
              <input className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" name="maxLength" type="number" min="1" max="500" defaultValue={fieldMaxLength(field.validationLimits, 120)} />
            </label>
          )}
          {(field.fieldType === "radio" || field.fieldType === "dropdown") && (
            <label className="block text-xs font-semibold">
              Opciones · una por línea
              <textarea className="mt-1 min-h-24 w-full resize-y rounded-lg border px-2 py-2 text-sm" name="options" defaultValue={fieldChoiceOptions(field.validationLimits).join("\n")} required />
            </label>
          )}
          {field.fieldType === "number" && (
            <div className="space-y-2 rounded-lg border border-slate-200 p-2">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input name="allowDecimals" type="hidden" value="false" />
                <input name="allowDecimals" type="checkbox" value="true" defaultChecked={field.validationLimits.allowDecimals !== false} />
                Permitir decimales
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs font-semibold">Mínimo<input className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" name="min" type="number" step="any" defaultValue={typeof field.validationLimits.min === "number" ? field.validationLimits.min : ""} /></label>
                <label className="text-xs font-semibold">Máximo<input className="mt-1 w-full rounded-lg border px-2 py-2 text-sm" name="max" type="number" step="any" defaultValue={typeof field.validationLimits.max === "number" ? field.validationLimits.max : ""} /></label>
              </div>
            </div>
          )}
          <button
            className="text-sm font-semibold text-[#11518b]"
            disabled={!editable || updatePending}
            type="submit"
          >
            Guardar
          </button>
          <Feedback state={updateState} />
        </form>
      )}
      {selected && (
        <form action={removeAction} className="mt-2">
          <input name="documentId" type="hidden" value={detail.id} />
          <input name="fieldId" type="hidden" value={field.id} />
          <button
            className="text-sm font-semibold text-red-700"
            disabled={!editable || removePending}
            type="submit"
          >
            Eliminar campo
          </button>
          <Feedback state={removeState} />
        </form>
      )}
    </div>
  );
}
