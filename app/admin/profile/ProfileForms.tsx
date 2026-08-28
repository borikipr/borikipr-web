"use client";

import { ChangeEvent, DragEvent, useActionState, useRef, useState } from "react";
import { Building2, Camera, Eye, EyeOff, ImagePlus, KeyRound, Mail, ShieldCheck, Trash2, Upload, UserRound } from "lucide-react";
import { changePassword, updateProfile, type ProfileState } from "./actions";

const initial: ProfileState = { error: "", success: "" };
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

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

function Avatar({ imageUrl, name, username, size = "default" }: { imageUrl: string; name: string; username: string; size?: "default" | "large" }) {
  const label = name || username;
  return <div className={`profile-avatar ${size === "large" ? "is-large" : ""}`}>
    {imageUrl ? <img src={imageUrl} alt={`Foto de perfil de ${label}`} /> : <span aria-label={`Iniciales de ${label}`}>{initials(label)}</span>}
  </div>;
}

function ProfilePhotoControl({ imageUrl, onChange, displayName, username }: { imageUrl: string; onChange: (url: string) => void; displayName: string; username: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!ACCEPTED_IMAGE_TYPES.has(file.type)) { setError("Usa una imagen JPG, PNG o WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { setError("La foto debe pesar menos de 5 MB."); return; }
    setUploading(true); setError("");
    try {
      const data = new FormData(); data.append("purpose", "profile"); data.append("files", file);
      const response = await fetch("/api/admin/upload", { method: "POST", body: data });
      const result = await response.json() as { ok?: boolean; urls?: string[]; error?: string };
      if (!response.ok || !result.ok || !result.urls?.[0]) throw new Error(result.error || "No se pudo subir la foto.");
      onChange(result.urls[0]);
    } catch (uploadError) { setError(uploadError instanceof Error ? uploadError.message : "No se pudo subir la foto."); }
    finally { setUploading(false); }
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) { void upload(event.target.files?.[0]); event.target.value = ""; }
  function onDrop(event: DragEvent<HTMLButtonElement>) { event.preventDefault(); setIsDragging(false); void upload(event.dataTransfer.files?.[0]); }

  return <div className="profile-photo-control">
    <Avatar imageUrl={imageUrl} name={displayName} username={username} size="large" />
    <div className="min-w-0 flex-1">
      <p className="profile-photo-label">Foto profesional</p>
      <p className="profile-photo-help">JPG, PNG o WebP · hasta 5 MB</p>
      <div className="profile-photo-actions">
        <button type="button" className={`profile-photo-upload ${isDragging ? "is-dragging" : ""}`} onClick={() => inputRef.current?.click()} onDragEnter={() => setIsDragging(true)} onDragLeave={() => setIsDragging(false)} onDragOver={(event) => event.preventDefault()} onDrop={onDrop} disabled={uploading}>
          {uploading ? <Upload aria-hidden="true" size={16} className="animate-pulse" /> : imageUrl ? <Camera aria-hidden="true" size={16} /> : <ImagePlus aria-hidden="true" size={16} />}
          {uploading ? "Subiendo…" : imageUrl ? "Cambiar foto" : "Añadir foto"}
        </button>
        {imageUrl && <button type="button" className="profile-photo-remove" onClick={() => { onChange(""); setError(""); }} disabled={uploading}><Trash2 aria-hidden="true" size={16}/>Eliminar foto</button>}
      </div>
      <input ref={inputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={onInput} aria-label="Seleccionar foto profesional" />
      {error && <p role="alert" className="profile-photo-error">{error}</p>}
    </div>
  </div>;
}

export default function ProfileForms({ displayName, professionalTitle, profileImageUrl, email, username, roleLabel }: {
  displayName: string; professionalTitle: string; profileImageUrl: string; email: string; username: string; roleLabel: string;
}) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initial);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, initial);
  const [imageUrl, setImageUrl] = useState(profileImageUrl);
  const effectiveTitle = professionalTitle || "Cargo profesional pendiente";
  return <div className="profile-settings-layout">
    <aside className="profile-account-summary" aria-label="Resumen de la cuenta">
      <Avatar imageUrl={imageUrl} name={displayName} username={username} />
      <div className="min-w-0">
        <h2>{displayName || username}</h2>
        <p className="profile-professional-title">{effectiveTitle}</p>
        <p className="profile-organization"><Building2 aria-hidden="true" size={14}/>Erickson Real Estate · Borikí</p>
        <p className="truncate" title={email || username}>{email || username}</p>
      </div>
      <div className="profile-role-note"><ShieldCheck aria-hidden="true" size={17}/><span>Rol del sistema: {roleLabel}</span></div>
    </aside>

    <div className="profile-settings-sections">
      <section className="profile-settings-section" aria-labelledby="profile-identity-heading">
        <header><UserRound aria-hidden="true" size={20}/><div><h2 id="profile-identity-heading">Identidad profesional</h2><p>Cómo te reconoce el equipo dentro de Erickson Real Estate y Borikí.</p></div></header>
        <form action={profileAction} className="profile-settings-form">
          <ProfilePhotoControl imageUrl={imageUrl} onChange={setImageUrl} displayName={displayName} username={username} />
          <input type="hidden" name="profileImageUrl" value={imageUrl} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><label htmlFor="displayName" className="text-sm font-semibold text-slate-800">Nombre visible</label><input id="displayName" name="displayName" className="input-premium" defaultValue={displayName} maxLength={100} autoComplete="name" required /></div>
            <div className="space-y-1.5"><label htmlFor="professionalTitle" className="text-sm font-semibold text-slate-800">Cargo profesional</label><input id="professionalTitle" name="professionalTitle" className="input-premium" defaultValue={professionalTitle} maxLength={120} placeholder="Por ejemplo, Corredora de Bienes Raíces" /></div>
          </div>
          <div className="profile-account-context"><span><Building2 aria-hidden="true" size={16}/>Organización</span><strong>Erickson Real Estate · Borikí</strong></div>
          <div className="profile-section-divider" />
          <div className="profile-inline-heading"><Mail aria-hidden="true" size={18}/><div><h3>Correo y recuperación</h3><p>Se usa para acceso y recuperación segura de la cuenta.</p></div></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><label htmlFor="email" className="text-sm font-semibold text-slate-800">Email</label><input id="email" name="email" type="email" className="input-premium" defaultValue={email} autoComplete="email" required /></div>
            <div className="space-y-1.5"><label htmlFor="username" className="text-sm font-semibold text-slate-800">Usuario</label><input id="username" className="input-premium bg-slate-50 text-slate-600" value={username} readOnly aria-readonly="true" /></div>
          </div>
          <PasswordField id="profileCurrentPassword" name="currentPassword" label="Confirma tu contraseña actual" autoComplete="current-password" />
          <p className="text-xs leading-5 text-slate-500">Borikí solicita tu contraseña antes de guardar cambios de identidad o recuperación.</p>
          <div className="profile-form-actions"><button type="submit" disabled={profilePending} className="btn-primary disabled:opacity-60">{profilePending ? "Guardando…" : "Guardar cambios"}</button><Feedback state={profileState}/></div>
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
