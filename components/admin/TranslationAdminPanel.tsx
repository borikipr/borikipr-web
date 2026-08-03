"use client";

import { useActionState } from "react";
import {
  authorizeTranslationRegeneration,
  confirmTranslationStillApplies,
  markTranslationReviewed,
  restoreTranslationRevision,
  saveManualTranslation,
} from "@/app/admin/translations/actions";
import type { TranslationAdminActionState } from "@/app/admin/translations/actions";
import { getTranslationAdminPresentation } from "@/lib/i18n/translations/admin-presentation";
import type { TranslationAdminField } from "@/lib/i18n/translations/admin-service";

const eventLabels: Record<string, string> = {
  created: "Registro creado",
  source_changed: "Cambió el español",
  job_queued: "Procesamiento solicitado",
  generation_succeeded: "Generación completada",
  generation_failed: "Generación fallida",
  manually_edited: "Edición o confirmación manual",
  reviewed: "Marcada como revisada",
  automation_unprotected: "Protección removida",
  regeneration_authorized: "Regeneración autorizada",
};

const initialTranslationAdminActionState: TranslationAdminActionState = {
  ok: false,
  message: "",
};

function dateLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("es-PR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
    : "No disponible";
}

function CommonInputs({ field }: { field: TranslationAdminField }) {
  return (
    <>
      <input type="hidden" name="translationId" value={field.translationId ?? ""} />
      <input type="hidden" name="entityType" value={field.entityType} />
      <input type="hidden" name="ownerId" value={field.ownerId} />
      <input type="hidden" name="expectedSourceHash" value={field.sourceHash} />
      <input type="hidden" name="expectedLockVersion" value={field.lockVersion} />
    </>
  );
}

function Feedback({ state }: { state: { ok: boolean; message: string } }) {
  if (!state.message) return null;
  return (
    <p role="status" aria-live="polite" className={`mt-3 text-sm font-semibold ${state.ok ? "text-emerald-800" : "text-red-700"}`}>
      {state.message}
    </p>
  );
}

function TranslationFieldPanel({ field }: { field: TranslationAdminField }) {
  const [editState, editAction, editPending] = useActionState(saveManualTranslation, initialTranslationAdminActionState);
  const [reviewState, reviewAction, reviewPending] = useActionState(markTranslationReviewed, initialTranslationAdminActionState);
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmTranslationStillApplies, initialTranslationAdminActionState);
  const [regenState, regenAction, regenPending] = useActionState(authorizeTranslationRegeneration, initialTranslationAdminActionState);
  const [restoreState, restoreAction, restorePending] = useActionState(restoreTranslationRevision, initialTranslationAdminActionState);
  const label = field.fieldKey === "title" ? "Título" : field.fieldKey === "description" ? "Descripción" : "Testimonio";
  const presentation = getTranslationAdminPresentation(field);
  const disabled = presentation.isMissing;

  return (
    <section className="min-w-0 rounded-2xl border border-black/10 bg-white p-4 sm:p-6" aria-labelledby={`translation-${field.fieldKey}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 id={`translation-${field.fieldKey}`} className="text-lg font-bold text-black">{label}</h3>
          <p className="mt-1 text-sm text-black/65">Español es la fuente principal. Inglés es contenido derivado.</p>
        </div>
        <span className="rounded-full border border-black/15 px-3 py-1 text-xs font-bold text-black">
          Estado: {presentation.status}
        </span>
      </div>

      <div className="mt-5 grid min-w-0 gap-4 lg:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-[#f5f2ec] p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-black/60">Fuente en español</p>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-black">{field.sourceValue || "Sin contenido"}</p>
        </div>
        <form action={editAction} className="min-w-0">
          <CommonInputs field={field} />
          <label htmlFor={`english-${field.translationId ?? field.fieldKey}`} className="text-xs font-bold uppercase tracking-wide text-black/60">
            Traducción al inglés
          </label>
          <textarea
            id={`english-${field.translationId ?? field.fieldKey}`}
            name="translatedValue"
            defaultValue={field.translatedValue ?? ""}
            disabled={disabled || editPending}
            rows={field.fieldKey === "title" ? 3 : 8}
            className="mt-2 w-full min-w-0 resize-y rounded-xl border border-black/20 bg-white p-3 text-sm text-black focus:border-black focus:outline-none focus:ring-2 focus:ring-black/15 disabled:bg-black/5"
          />
          <button type="submit" className="btn-primary mt-3" disabled={disabled || editPending}>
            {editPending ? "Guardando…" : "Guardar edición manual"}
          </button>
          <Feedback state={editState} />
        </form>
      </div>

      {disabled ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Aún no existe el registro de traducción. Se creará mediante el flujo controlado de intención o backfill.
        </p>
      ) : null}

      <dl className="mt-5 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="font-semibold">Origen</dt><dd>{presentation.origin}</dd></div>
        <div><dt className="font-semibold">Revisión</dt><dd>{presentation.review}</dd></div>
        <div><dt className="font-semibold">Protección</dt><dd>{presentation.protection}</dd></div>
        <div><dt className="font-semibold">Vigencia</dt><dd>{presentation.freshness}</dd></div>
        <div><dt className="font-semibold">Última generación</dt><dd>{presentation.isMissing ? "No aplica" : dateLabel(field.generatedAt)}</dd></div>
        <div><dt className="font-semibold">Última edición manual</dt><dd>{presentation.isMissing ? "No aplica" : dateLabel(field.manuallyEditedAt)}</dd></div>
        <div><dt className="font-semibold">Revisión</dt><dd>{presentation.isMissing ? "No aplica" : field.reviewerName ? `${field.reviewerName} · ${dateLabel(field.reviewedAt)}` : dateLabel(field.reviewedAt)}</dd></div>
        <div><dt className="font-semibold">{presentation.activeJobTerm}</dt><dd>{presentation.job}</dd></div>
        <div><dt className="font-semibold">Automatización</dt><dd>{presentation.automation}</dd></div>
      </dl>

      {field.status === "stale" ? (
        <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
          El español cambió. El valor inglés anterior se conserva, pero no está vigente.
        </p>
      ) : null}

      {!disabled ? (
        <div className="mt-5 flex flex-wrap gap-3 border-t border-black/10 pt-5">
          {field.status === "ready" && field.isFresh && field.reviewStatus !== "reviewed" ? (
            <form action={reviewAction}><CommonInputs field={field} /><button className="btn-secondary" disabled={reviewPending}>Marcar como revisada</button></form>
          ) : null}
          {field.status === "stale" && field.protectedFromAutomation && field.translatedValue ? (
            <form action={confirmAction} onSubmit={(event) => { if (!window.confirm("Confirma que la traducción todavía aplica al español actual.")) event.preventDefault(); }}>
              <CommonInputs field={field} /><button className="btn-secondary" disabled={confirmPending}>Confirmar que todavía aplica</button>
            </form>
          ) : null}
          <form action={regenAction} onSubmit={(event) => { if (!window.confirm("Esta acción removerá la protección manual o revisada y autorizará que una futura generación automática reemplace el valor actual.")) event.preventDefault(); }}>
            <CommonInputs field={field} /><button className="rounded-full border border-red-700 px-4 py-2 text-sm font-bold text-red-800 hover:bg-red-50" disabled={regenPending}>Autorizar regeneración</button>
          </form>
        </div>
      ) : null}
      <Feedback state={reviewState} /><Feedback state={confirmState} /><Feedback state={regenState} />

      {field.events.length ? (
        <details className="mt-6 border-t border-black/10 pt-5">
          <summary className="cursor-pointer font-bold text-black">Historial ({field.events.length})</summary>
          <ol className="mt-4 space-y-3">
            {field.events.map((event) => {
              const restorable = event.newValue?.trim() || event.previousValue?.trim();
              return (
                <li key={event.id} className="min-w-0 rounded-xl bg-black/[0.03] p-3 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>{eventLabels[event.eventType] ?? event.eventType}</strong>
                    <time dateTime={event.createdAt}>{dateLabel(event.createdAt)}</time>
                  </div>
                  <p className="mt-1 text-black/65">{event.actorName ? `Por ${event.actorName}` : event.jobId ? "Acción automática" : "Sistema"}</p>
                  {event.previousStatus || event.newStatus ? <p className="mt-1">Estado: {event.previousStatus ?? "—"} → {event.newStatus ?? "—"}</p> : null}
                  {event.newValue ? <p className="mt-2 whitespace-pre-wrap break-words rounded-lg bg-white p-2">{event.newValue}</p> : null}
                  {restorable ? (
                    <form action={restoreAction} className="mt-2" onSubmit={(submitEvent) => { if (!window.confirm("¿Restaurar esta versión como una edición manual protegida?")) submitEvent.preventDefault(); }}>
                      <CommonInputs field={field} /><input type="hidden" name="eventId" value={event.id} />
                      <button className="text-sm font-bold underline" disabled={restorePending}>Restaurar versión</button>
                    </form>
                  ) : null}
                </li>
              );
            })}
          </ol>
          <Feedback state={restoreState} />
        </details>
      ) : null}
    </section>
  );
}

export default function TranslationAdminPanel({ fields }: { fields: TranslationAdminField[] }) {
  return (
    <section className="mt-10 min-w-0" aria-labelledby="english-translations-heading">
      <div className="mb-5">
        <p className="eyebrow">Contenido derivado</p>
        <h2 id="english-translations-heading" className="mt-2 text-2xl font-bold text-black">Traducciones al inglés</h2>
        <p className="body-base mt-2">Revisa o corrige el inglés sin modificar la fuente en español.</p>
      </div>
      <div className="grid min-w-0 gap-5">{fields.map((field) => <TranslationFieldPanel key={field.fieldKey} field={field} />)}</div>
    </section>
  );
}
