"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

type Option = Readonly<{ id: string; label: string }>;
type DocumentType = Readonly<{ id: string; label: string; scope: string }>;

export default function NewSignatureDraftForm({
  documentTypes,
  leads,
  groups,
}: {
  documentTypes: readonly DocumentType[];
  leads: readonly Option[];
  groups: readonly Option[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => setHydrated(true), []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/signatures/drafts", {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
      });
      const body = await response.json() as { ok?: boolean; documentId?: string; error?: string };
      if (!response.ok || !body.ok || !body.documentId) {
        setMessage(body.error ?? "No se pudo crear el borrador.");
        return;
      }
      router.push(`/admin/signatures/${body.documentId}`);
      router.refresh();
    } catch {
      setMessage("No se pudo crear el borrador.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="surface-card space-y-6 p-6 md:p-8" onSubmit={submit}>
      <div className="grid gap-5 md:grid-cols-2">
        <label><span className="text-sm font-semibold">Título interno</span><input className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" maxLength={200} name="title" required /></label>
        <label><span className="text-sm font-semibold">Tipo de documento</span><select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="documentType" required defaultValue=""><option disabled value="">Selecciona</option>{documentTypes.map((type) => <option key={type.id} value={type.id}>{type.label} · {type.scope === "ordinary_brokerage" ? "flujo ordinario de corretaje" : "confirmar alcance/formalidades"}</option>)}</select></label>
        <label><span className="text-sm font-semibold">Lead 360 (opcional)</span><select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="canonicalLeadId" defaultValue=""><option value="">Sin enlace</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.label}</option>)}</select></label>
        <label><span className="text-sm font-semibold">Caso compartido (opcional)</span><select className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" name="leadGroupId" defaultValue=""><option value="">Sin enlace</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}</select></label>
        <label><span className="text-sm font-semibold">Fecha de expiración</span><input className="mt-2 w-full rounded-xl border border-[#d9d9d9] px-4 py-3" min={new Date().toISOString().slice(0, 10)} name="expiresOn" required type="date" /></label>
      </div>
      <label className="block"><span className="text-sm font-semibold">PDF fuente</span><input accept="application/pdf,.pdf" className="mt-2 block w-full rounded-xl border border-dashed border-[#a8a8a8] p-4" name="sourcePdf" required type="file" /><span className="mt-2 block text-xs text-[#666]">Máximo 3 MB y 25 páginas. Se rechazará contenido cifrado, XFA, adjuntos, acciones, JavaScript o firmas digitales existentes.</span></label>
      {message && <p aria-live="polite" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{message}</p>}
      <button className="btn-primary" disabled={busy || !hydrated} type="submit">{!hydrated ? "Preparando…" : busy ? "Validando PDF…" : "Guardar y continuar"}</button>
    </form>
  );
}
