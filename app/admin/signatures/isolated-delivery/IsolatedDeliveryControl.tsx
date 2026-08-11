"use client";

import { useState } from "react";

type Delivery = Readonly<{
  signingUrl: string;
  kind: "invitation" | "completed_document";
}>;

export function IsolatedDeliveryControl() {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [status, setStatus] = useState("Listo para procesar la próxima entrega sintética.");
  const [busy, setBusy] = useState(false);

  async function processDelivery() {
    setBusy(true);
    setDelivery(null);
    try {
      const response = await fetch("/api/admin/signatures/isolated-sink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) {
        setStatus("No hay una entrega sintética pendiente.");
        return;
      }
      const value = (await response.json()) as Delivery & { ok: boolean };
      setDelivery({ signingUrl: value.signingUrl, kind: value.kind });
      setStatus("Entrega sintética procesada. El enlace solo vive en esta vista aislada.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="isolated-delivery-heading">
      <h2 id="isolated-delivery-heading">Control de entrega aislada</h2>
      <p>{status}</p>
      <button type="button" disabled={busy} onClick={processDelivery}>
        {busy ? "Procesando…" : "Procesar próxima entrega sintética"}
      </button>
      {delivery ? (
        <p>
          <a href={delivery.signingUrl} referrerPolicy="no-referrer" rel="noreferrer">
            {delivery.kind === "invitation" ? "Abrir invitación sintética" : "Abrir entrega completada sintética"}
          </a>
        </p>
      ) : null}
    </section>
  );
}
