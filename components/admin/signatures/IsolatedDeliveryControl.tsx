"use client";

import { useState } from "react";

export default function IsolatedDeliveryControl() {
  const [signingUrl, setSigningUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);

  async function processOne() {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/signatures/isolated-sink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "same-origin",
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok?: boolean; signingUrl?: string }
        | null;
      if (!response.ok || !payload?.ok || !payload.signingUrl) {
        throw new Error("signature_isolated_delivery_unavailable");
      }
      setSigningUrl(payload.signingUrl);
      setMessage("Entrega sintética preparada en memoria.");
    } catch {
      setMessage("No hay una entrega sintética pendiente disponible.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="surface-card border-2 border-dashed border-amber-400 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-800">
        Entorno aislado · solo pruebas sintéticas
      </p>
      <p className="mt-2 text-sm text-[#555]">
        Procesa una sola entrega en el adaptador de memoria. No envía correo externo.
      </p>
      <button className="btn-secondary mt-3" disabled={pending} onClick={processOne} type="button">
        {pending ? "Procesando…" : "Procesar una entrega sintética"}
      </button>
      {message && <p aria-live="polite" className="mt-3 text-sm">{message}</p>}
      {signingUrl && (
        <a className="btn-primary mt-3 inline-flex" href={signingUrl} rel="noreferrer" referrerPolicy="no-referrer">
          Abrir sesión sintética de firma
        </a>
      )}
    </section>
  );
}
