"use client";
import { useRef, useState } from "react";

export function LeadsExportControl({ query, operational = true }: { query: string; operational?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/admin/leads/export${query ? `?${query}` : ""}`, { cache: "no-store" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "No se pudo exportar."); }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? "boriki-leads.csv";
      anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      dialog.current?.close();
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo exportar."); }
    finally { setBusy(false); }
  }
  return <>
    <button ref={trigger} type="button" className="btn-secondary min-h-11" disabled={!operational} title={!operational ? "Disponible en la vista operacional de Leads y casos." : undefined} onClick={() => { setError(""); dialog.current?.showModal(); }}>Exportar</button>
    <dialog ref={dialog} aria-labelledby="leads-export-title" onClose={() => trigger.current?.focus()} className="m-auto w-[calc(100%_-_2rem)] max-w-md rounded-2xl border border-slate-200 p-5 backdrop:bg-black/40">
      <h2 id="leads-export-title" className="text-xl font-semibold">Exportar Leads</h2>
      <p className="mt-3 text-sm"><strong>Resultados actuales</strong> · Se incluyen todos los registros operacionales que coinciden con los filtros, no sólo esta página.</p>
      <p className="mt-3 text-sm">Este archivo contiene información de clientes. Guárdalo de forma segura.</p>
      <p className="mt-2 text-sm text-slate-600">Es una copia operacional puntual y no sustituye un respaldo restaurable de la base de datos.</p>
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-secondary min-h-11" onClick={() => dialog.current?.close()}>Cancelar</button>
        <button type="button" className="btn-primary min-h-11" disabled={busy} onClick={download}>{busy ? "Generando…" : "Descargar CSV"}</button>
      </div>
    </dialog>
  </>;
}
