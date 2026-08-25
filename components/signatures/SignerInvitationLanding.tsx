"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

export default function SignerInvitationLanding() {
  const fragmentProcessed = useRef(false);
  const tokenInputRef = useRef<HTMLInputElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (fragmentProcessed.current) return;
    fragmentProcessed.current = true;
    const candidate = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (!/^[A-Za-z0-9_-]{43}$/.test(candidate)) {
      window.location.replace("/firmar/enlace-invalido");
      return;
    }
    if (tokenInputRef.current) tokenInputRef.current.value = candidate;
    if (continueButtonRef.current) continueButtonRef.current.disabled = false;
  }, []);

  async function exchangeInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const token = String(formData.get("token") ?? "");
    if (!/^[A-Za-z0-9_-]{43}$/.test(token) || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(event.currentTarget.action, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (response.status !== 204) {
        const payload = response.status === 410 ? await response.json().catch(() => null) as {reason?:string}|null : null;
        const messages:Record<string,string>={
          replaced:"Esta invitación fue reemplazada por una más reciente. Usa el enlace del correo más nuevo.",
          expired:"Esta invitación expiró. Comunícate con Erickson Real Estate para solicitar un nuevo acceso.",
          cancelled:"Esta solicitud fue cancelada y ya no está disponible para firma.",
          completed:"Tu participación o el documento ya fue completado. No es necesario volver a firmar.",
          unavailable:"Esta invitación no está disponible en este momento. Verifica el correo más reciente o comunícate con Erickson Real Estate.",
        };
        setError(messages[payload?.reason??""]??"No se pudo validar este enlace. Verifica que sea la invitación más reciente e intenta nuevamente.");
        setSubmitting(false);
        return;
      }
      window.location.assign("/firmar/sesion");
    } catch {
      setError("No se pudo validar este enlace. Verifica que sea la invitación más reciente e intenta nuevamente.");
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">BorikiPR</p>
        <h1 className="mt-2 text-2xl font-semibold">Documento privado para firma</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Continúa únicamente si esperabas recibir esta solicitud. El enlace se intercambia por una sesión privada al continuar.
        </p>
        <form action="/api/signatures/session/exchange" method="post" className="mt-6" onSubmit={exchangeInvitation}>
          <input ref={tokenInputRef} type="hidden" name="token" />
          <button ref={continueButtonRef} disabled className="w-full rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
            {submitting ? "Validando enlace…" : "Continuar de forma segura"}
          </button>
          {error ? <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{error}</p> : null}
        </form>
      </div>
    </section>
  );
}
