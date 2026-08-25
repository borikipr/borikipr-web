"use client";

import { useMemo, useState } from "react";

type NavigableField = Readonly<{
  id: string;
  label: string;
  field_type: string;
  page_index: number;
  required: boolean;
  completed: boolean;
}>;

export default function SignerRequiredFieldNavigator({ fields }: { fields: readonly NavigableField[] }) {
  const actionable = useMemo(() => fields.filter((field) => field.required && field.field_type !== "date_signed"), [fields]);
  const pending = useMemo(() => actionable.filter((field) => !field.completed), [actionable]);
  const [cursor, setCursor] = useState(0);
  const completed = actionable.length - pending.length;

  function nextRequiredField() {
    if (!pending.length) return;
    const field = pending[cursor % pending.length];
    setCursor((value) => value + 1);
    window.dispatchEvent(new CustomEvent("boriki:signer-page", { detail: { pageIndex: field.page_index } }));
    window.setTimeout(() => {
      const container = document.getElementById(`signer-field-${field.id}`);
      container?.scrollIntoView({ behavior: "smooth", block: "center" });
      (container?.querySelector("input,button,canvas") as HTMLElement | null)?.focus({ preventScroll: true });
    }, 80);
  }

  return <nav className="sticky top-2 z-20 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm backdrop-blur" aria-label="Progreso de campos requeridos">
    <div><p className="text-sm font-semibold">{completed} de {actionable.length} campos requeridos completados</p><p className="text-xs text-slate-600">El documento permanece visible mientras avanzas.</p></div>
    <button className="min-h-11 rounded-lg bg-[#0d1b2a] px-4 py-2 text-sm font-semibold text-white disabled:bg-slate-300" disabled={!pending.length} onClick={nextRequiredField} type="button">{pending.length ? "Próximo campo" : "Campos completados"}</button>
  </nav>;
}
