"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, UserRound } from "lucide-react";
import { changePassword, updateProfile, type ProfileState } from "./actions";

const initial: ProfileState = { error: "", success: "" };

function Feedback({ state }: { state: ProfileState }) {
  if (state.error) return <p role="alert" className="profile-feedback is-error">{state.error}</p>;
  if (state.success) return <p role="status" className="profile-feedback is-success">{state.success}</p>;
  return null;
}

function PasswordField({ id, name, label, autoComplete, minLength }: {
  id: string; name: string; label: string; autoComplete: "current-password" | "new-password"; minLength?: number;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="space-y-1.5">
    <label htmlFor={id} className="text-sm font-semibold text-slate-800">{label}</label>
    <div className="profile-password-control">
      <input id={id} name={name} type={visible ? "text" : "password"} className="input-premium" autoComplete={autoComplete} minLength={minLength} required />
      <button type="button" aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((value) => !value)}>
        {visible ? <EyeOff aria-hidden="true" size={18}/> : <Eye aria-hidden="true" size={18}/>}
      </button>
    </div>
  </div>;
}

function initials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "A"}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}

export default function ProfileForms({ displayName, email, username, roleLabel }: {
  displayName: string; email: string; username: string; roleLabel: string;
}) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initial);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, initial);
  return <div className="profile-settings-layout">
    <aside className="profile-account-summary" aria-label="Resumen de la cuenta">
      <div className="profile-avatar" aria-hidden="true">{initials(displayName || username)}</div>
      <div className="min-w-0">
        <h2>{displayName || username}</h2>
        <p>{roleLabel}</p>
        <p className="truncate" title={email || username}>{email || username}</p>
      </div>
      <div className="profile-security-note"><ShieldCheck aria-hidden="true" size={18}/><span>Cuenta administrativa protegida</span></div>
    </aside>

    <div className="profile-settings-sections">
      <section className="profile-settings-section" aria-labelledby="profile-account-heading">
        <header><UserRound aria-hidden="true" size={20}/><div><h2 id="profile-account-heading">Cuenta</h2><p>Información que identifica tu cuenta dentro de Borikí.</p></div></header>
        <form action={profileAction} className="profile-settings-form">
          <div className="space-y-1.5"><label htmlFor="displayName" className="text-sm font-semibold text-slate-800">Nombre visible</label><input id="displayName" name="displayName" className="input-premium" defaultValue={displayName} maxLength={100} autoComplete="name" required /></div>
          <div className="space-y-1.5"><label htmlFor="username" className="text-sm font-semibold text-slate-800">Usuario</label><input id="username" className="input-premium bg-slate-50 text-slate-600" value={username} readOnly aria-readonly="true" /></div>
          <div className="profile-section-divider" />
          <div className="profile-inline-heading"><Mail aria-hidden="true" size={18}/><div><h3>Correo y recuperación</h3><p>Se usa para acceso y recuperación segura de la cuenta.</p></div></div>
          <div className="space-y-1.5"><label htmlFor="email" className="text-sm font-semibold text-slate-800">Email</label><input id="email" name="email" type="email" className="input-premium" defaultValue={email} autoComplete="email" required /></div>
          <PasswordField id="profileCurrentPassword" name="currentPassword" label="Confirma tu contraseña actual" autoComplete="current-password" />
          <p className="text-xs leading-5 text-slate-500">Borikí solicita tu contraseña antes de guardar cambios de identidad o recuperación.</p>
          <div className="profile-form-actions"><button type="submit" disabled={profilePending} className="btn-primary disabled:opacity-60">{profilePending ? "Guardando…" : "Guardar perfil"}</button><Feedback state={profileState}/></div>
        </form>
      </section>

      <section className="profile-settings-section" aria-labelledby="profile-security-heading">
        <header><KeyRound aria-hidden="true" size={20}/><div><h2 id="profile-security-heading">Seguridad</h2><p>Actualiza la contraseña y cierra las demás sesiones activas.</p></div></header>
        <form action={passwordAction} className="profile-settings-form">
          <PasswordField id="passwordCurrent" name="currentPassword" label="Contraseña actual" autoComplete="current-password" />
          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField id="newPassword" name="newPassword" label="Nueva contraseña" autoComplete="new-password" minLength={12} />
            <PasswordField id="confirmation" name="confirmation" label="Confirmar nueva contraseña" autoComplete="new-password" minLength={12} />
          </div>
          <p className="text-sm leading-6 text-slate-600">Usa al menos 12 caracteres con mayúsculas, minúsculas y un número. El cambio cerrará las demás sesiones.</p>
          <div className="profile-form-actions"><button type="submit" disabled={passwordPending} className="btn-primary disabled:opacity-60">{passwordPending ? "Actualizando…" : "Cambiar contraseña"}</button><Feedback state={passwordState}/></div>
        </form>
      </section>
    </div>
  </div>;
}
