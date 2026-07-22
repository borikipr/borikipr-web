"use client";

import { useActionState } from "react";
import { submitPasswordReset, type ResetPasswordState } from "./actions";

const initialState: ResetPasswordState = { error: "" };

export default function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(submitPasswordReset, initialState);
  return (
    <form action={action} className="mt-8 space-y-5">
      <input type="hidden" name="token" value={token} />
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-[#000000]">Nueva contraseña</label>
        <input id="password" name="password" type="password" className="input-premium" autoComplete="new-password" minLength={12} required />
      </div>
      <div className="space-y-2">
        <label htmlFor="confirmation" className="text-sm font-medium text-[#000000]">Confirmar contraseña</label>
        <input id="confirmation" name="confirmation" type="password" className="input-premium" autoComplete="new-password" minLength={12} required />
      </div>
      <p className="text-sm leading-6 text-[#4d4d4d]">Usa al menos 12 caracteres con mayúsculas, minúsculas y un número.</p>
      <button type="submit" disabled={pending} className="btn-primary w-full disabled:opacity-60">{pending ? "Actualizando..." : "Guardar contraseña"}</button>
      {state.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
    </form>
  );
}
