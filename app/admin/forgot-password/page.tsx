"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = { submitted: false };

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);
  return (
    <main className="min-h-screen bg-[#f8f8f8] px-6 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="surface-card w-full p-8 md:p-10">
          <p className="eyebrow">Acceso privado</p>
          <h1 className="mt-4 text-3xl font-bold text-[#000000]">Recuperar contraseña</h1>
          <p className="body-base mt-4">Ingresa el email asociado a tu cuenta administrativa.</p>
          {state.submitted ? (
            <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900" role="status">
              Si existe una cuenta, recibirás un email para restablecer tu contraseña.
            </div>
          ) : (
            <form action={action} className="mt-8 space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-[#000000]">Email</label>
                <input id="email" name="email" type="email" className="input-premium" autoComplete="email" required />
              </div>
              <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">
                {pending ? "Procesando..." : "Enviar enlace"}
              </button>
            </form>
          )}
          <Link href="/admin/login" className="mt-6 inline-flex text-sm font-semibold text-[#11518b] hover:text-[#0d406d]">Volver al acceso</Link>
        </div>
      </div>
    </main>
  );
}
