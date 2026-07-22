"use client";

import { useActionState } from "react";
import { changePassword, updateProfile, type ProfileState } from "./actions";

const initial: ProfileState = { error: "", success: "" };

function Feedback({ state }: { state: ProfileState }) {
  if (state.error) return <p role="alert" className="text-sm text-red-600">{state.error}</p>;
  if (state.success) return <p role="status" className="text-sm text-emerald-700">{state.success}</p>;
  return null;
}

export default function ProfileForms({ displayName, email, username }: { displayName: string; email: string; username: string }) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initial);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, initial);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="surface-card p-6 md:p-8">
        <h2 className="text-xl font-semibold text-[#000000]">Información de la cuenta</h2>
        <form action={profileAction} className="mt-6 space-y-5">
          <div className="space-y-2"><label htmlFor="displayName" className="text-sm font-medium">Nombre visible</label><input id="displayName" name="displayName" className="input-premium" defaultValue={displayName} maxLength={100} required /></div>
          <div className="space-y-2"><label htmlFor="username" className="text-sm font-medium">Usuario</label><input id="username" className="input-premium bg-[#f1f1f1]" value={username} readOnly aria-readonly="true" /></div>
          <div className="space-y-2"><label htmlFor="email" className="text-sm font-medium">Email</label><input id="email" name="email" type="email" className="input-premium" defaultValue={email} autoComplete="email" required /></div>
          <div className="space-y-2"><label htmlFor="profileCurrentPassword" className="text-sm font-medium">Contraseña actual</label><input id="profileCurrentPassword" name="currentPassword" type="password" className="input-premium" autoComplete="current-password" required /><p className="text-xs leading-5 text-[#666]">Se solicita para proteger cambios al email de recuperación.</p></div>
          <button type="submit" disabled={profilePending} className="btn-primary disabled:opacity-60">{profilePending ? "Guardando..." : "Guardar perfil"}</button>
          <Feedback state={profileState} />
        </form>
      </section>

      <section className="surface-card p-6 md:p-8">
        <h2 className="text-xl font-semibold text-[#000000]">Cambiar contraseña</h2>
        <form action={passwordAction} className="mt-6 space-y-5">
          <div className="space-y-2"><label htmlFor="passwordCurrent" className="text-sm font-medium">Contraseña actual</label><input id="passwordCurrent" name="currentPassword" type="password" className="input-premium" autoComplete="current-password" required /></div>
          <div className="space-y-2"><label htmlFor="newPassword" className="text-sm font-medium">Nueva contraseña</label><input id="newPassword" name="newPassword" type="password" className="input-premium" autoComplete="new-password" minLength={12} required /></div>
          <div className="space-y-2"><label htmlFor="confirmation" className="text-sm font-medium">Confirmar contraseña</label><input id="confirmation" name="confirmation" type="password" className="input-premium" autoComplete="new-password" minLength={12} required /></div>
          <p className="text-sm leading-6 text-[#4d4d4d]">Mínimo 12 caracteres, con mayúsculas, minúsculas y un número. El cambio cerrará las demás sesiones.</p>
          <button type="submit" disabled={passwordPending} className="btn-primary disabled:opacity-60">{passwordPending ? "Actualizando..." : "Cambiar contraseña"}</button>
          <Feedback state={passwordState} />
        </form>
      </section>
    </div>
  );
}
