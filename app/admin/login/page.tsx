"use client";

import { useActionState } from "react";
import { loginAdmin, type LoginState } from "./actions";

const initialState: LoginState = {
  error: "",
};

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(
    loginAdmin,
    initialState
  );

  return (
    <main className="min-h-screen bg-[#f8f8f8] px-6 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="surface-card w-full p-8 md:p-10">
          <p className="eyebrow">Acceso privado</p>

          <h1 className="mt-4 text-3xl font-bold text-[#000000]">
            Panel admin
          </h1>

          <p className="body-base mt-4">
            Ingresa con tus credenciales para administrar propiedades.
          </p>

          <form action={formAction} className="mt-8 space-y-5">
            <div className="space-y-2">
              <label
                htmlFor="username"
                className="text-sm font-medium text-[#000000]"
              >
                Usuario
              </label>
              <input
                id="username"
                name="username"
                type="text"
                className="input-premium"
                placeholder="Tu usuario"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="password"
                className="text-sm font-medium text-[#000000]"
              >
                Contraseña
              </label>
              <input
                id="password"
                name="password"
                type="password"
                className="input-premium"
                placeholder="Tu contraseña"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="btn-primary w-full disabled:opacity-60"
            >
              {pending ? "Entrando..." : "Entrar"}
            </button>

            {state.error && (
              <p className="text-sm text-red-600">{state.error}</p>
            )}
          </form>
        </div>
      </div>
    </main>
  );
}