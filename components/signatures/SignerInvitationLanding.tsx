"use client";

import { useEffect, useRef } from "react";

export default function SignerInvitationLanding() {
  const tokenInput = useRef<HTMLInputElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  const fragmentProcessed = useRef(false);

  useEffect(() => {
    if (fragmentProcessed.current) return;
    fragmentProcessed.current = true;
    const candidate = window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    if (!/^[A-Za-z0-9_-]{43}$/.test(candidate)) {
      window.location.replace("/firmar/enlace-invalido");
      return;
    }
    if (tokenInput.current) tokenInput.current.value = candidate;
    if (continueButton.current) continueButton.current.disabled = false;
  }, []);

  return (
    <section className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">BorikiPR</p>
        <h1 className="mt-2 text-2xl font-semibold">Documento privado para firma</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Continúa únicamente si esperabas recibir esta solicitud. El enlace se intercambia por una sesión privada al continuar.
        </p>
        <form action="/api/signatures/session/exchange" method="post" className="mt-6">
          <input ref={tokenInput} type="hidden" name="token" />
          <button ref={continueButton} disabled className="w-full rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-wait disabled:opacity-60">
            Continuar de forma segura
          </button>
        </form>
      </div>
    </section>
  );
}
