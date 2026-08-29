"use client";

import { ChangeEvent, DragEvent, KeyboardEvent, type CSSProperties, useActionState, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, Building2, Camera, ChevronDown, ChevronUp, Eye, EyeOff, ImagePlus, KeyRound, Mail, ShieldCheck, Trash2, Upload, UserRound, X } from "lucide-react";
import { changePassword, updateProfile, type ProfileState } from "./actions";
import { PROFESSIONAL_ROLE_OPTIONS, professionalRoleLabels, professionalRoleTitle, rolesRequireLicense, type ProfessionalRoleId } from "@/lib/admin/professional-profile";

const initial: ProfileState = { error: "", success: "" };
const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
const rolePanelStyle: CSSProperties = { background: "#fff", border: "1px solid #cbd5e1", borderRadius: ".625rem", boxShadow: "0 12px 24px rgb(15 23 42 / 16%)", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: ".125rem", left: 0, marginTop: ".375rem", maxHeight: "min(20rem, calc(100vh - 11rem))", overflowY: "auto", padding: ".25rem", position: "absolute", right: 0, top: "100%", zIndex: 50 };

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

export function RolePicker({ roles, onChange, customTitle, onCustomTitleChange }: {
  roles: ProfessionalRoleId[]; onChange: (roles: ProfessionalRoleId[]) => void; customTitle: string; onCustomTitleChange: (title: string) => void;
}) {
  const [open, setOpen] = useState(false); const [query, setQuery] = useState(""); const [activeIndex, setActiveIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => PROFESSIONAL_ROLE_OPTIONS.filter((role) => role.label.toLocaleLowerCase("es-PR").includes(query.toLocaleLowerCase("es-PR"))), [query]);
  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [open]);
  function toggle(role: ProfessionalRoleId) {
    if (roles.includes(role)) onChange(roles.filter((value) => value !== role));
    else if (roles.length < 2) onChange([...roles, role]);
    setQuery(""); setActiveIndex(0);
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0))); return; }
    if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(index - 1, 0)); return; }
    if ((event.key === "Enter" || event.key === " ") && open && filtered[activeIndex]) { event.preventDefault(); toggle(filtered[activeIndex].id); }
  }
  return <div className="profile-role-picker">
    <label htmlFor="professionalRoleSearch" className="text-sm font-semibold text-slate-800">Roles profesionales</label>
    <p className="mt-1 text-xs leading-5 text-slate-500">Selecciona hasta dos roles que describan tu trabajo; no cambian tus permisos.</p>
    <div className="profile-role-chips" aria-live="polite">
      {roles.map((role) => <span key={role} className="profile-role-chip">{professionalRoleLabels([role], customTitle)[0]}<button type="button" onClick={() => toggle(role)} aria-label={`Eliminar ${professionalRoleLabels([role], customTitle)[0]}`}><X aria-hidden="true" size={14}/></button></span>)}
    </div>
    <div ref={pickerRef} className={`profile-role-control ${open ? "is-open" : ""}`} style={{ marginTop: ".5rem", position: "relative" }}>
      <input id="professionalRoleSearch" role="combobox" aria-expanded={open} aria-controls="professional-role-options" aria-activedescendant={open && filtered[activeIndex] ? `professional-role-${filtered[activeIndex].id}` : undefined} className="input-premium" style={{ paddingRight: "3rem", ...(open ? { borderColor: "#11518b", boxShadow: "0 0 0 3px rgb(17 81 139 / 12%)" } : {}) }} value={query} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); }} onKeyDown={onKeyDown} placeholder={roles.length >= 2 ? "Máximo de dos roles seleccionado" : "Buscar o seleccionar un rol"} disabled={roles.length >= 2} />
      <button type="button" className="profile-role-toggle" style={{ alignItems: "center", borderRadius: ".375rem", color: "#475569", display: "inline-flex", height: "2.5rem", justifyContent: "center", position: "absolute", right: ".25rem", top: ".25rem", width: "2.5rem" }} onClick={() => setOpen((value) => !value)} aria-label={open ? "Cerrar opciones de roles profesionales" : "Abrir opciones de roles profesionales"} aria-controls="professional-role-options" aria-expanded={open} disabled={roles.length >= 2}>{open ? <ChevronUp aria-hidden="true" size={18}/> : <ChevronDown aria-hidden="true" size={18}/>}</button>
      {open && <div id="professional-role-options" role="listbox" aria-label="Opciones de roles profesionales" className="profile-role-options" style={rolePanelStyle}>
        {filtered.length ? filtered.map((role, index) => { const selected = roles.includes(role.id); const disabled = !selected && roles.length >= 2; return <button key={role.id} id={`professional-role-${role.id}`} type="button" role="option" aria-selected={selected} disabled={disabled} className={index === activeIndex ? "is-active" : ""} style={{ alignItems: "center", borderRadius: ".375rem", color: selected || index === activeIndex ? "#0d4d84" : "#1e293b", display: "flex", flex: "0 0 auto", fontSize: ".875rem", gap: ".75rem", justifyContent: "space-between", minHeight: "2.5rem", padding: ".5rem .75rem", textAlign: "left", width: "100%", ...(selected || index === activeIndex ? { background: "#eff6ff" } : {}) }} onMouseDown={(event) => event.preventDefault()} onClick={() => toggle(role.id)}><span>{role.label}</span>{selected ? <BadgeCheck aria-label="Seleccionado" size={16}/> : null}</button>; }) : <p className="px-3 py-2 text-sm text-slate-500">No encontramos ese rol.</p>}
      </div>}
    </div>
    <input type="hidden" name="professionalRoles" value={JSON.stringify(roles)} />
    {roles.includes("other") && <div className="mt-3 space-y-1.5"><label htmlFor="professionalCustomTitle" className="text-sm font-semibold text-slate-800">Describe tu otro rol</label><input id="professionalCustomTitle" name="professionalCustomTitle" className="input-premium" value={customTitle} onChange={(event) => onCustomTitleChange(event.target.value)} maxLength={120} required placeholder="Por ejemplo, Diseño de experiencias" /></div>}
    {roles.length >= 2 && <p className="mt-2 text-xs font-medium text-slate-600">Máximo de dos roles profesionales.</p>}
  </div>;
}

export default function ProfileForms({ displayName, professionalTitle, professionalRoles, professionalLicenseNumber, profileImageUrl, email, username, roleLabel }: {
  displayName: string; professionalTitle: string; professionalRoles: ProfessionalRoleId[]; professionalLicenseNumber: string; profileImageUrl: string; email: string; username: string; roleLabel: string;
}) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfile, initial);
  const [passwordState, passwordAction, passwordPending] = useActionState(changePassword, initial);
  const [imageUrl, setImageUrl] = useState(profileImageUrl);
  const initialRoles = professionalRoles.length ? professionalRoles : professionalTitle ? ["other"] as ProfessionalRoleId[] : [];
  const [roles, setRoles] = useState<ProfessionalRoleId[]>(initialRoles);
  const [customTitle, setCustomTitle] = useState(initialRoles.includes("other") ? professionalTitle : "");
  const [licenseNumber, setLicenseNumber] = useState(professionalLicenseNumber);
  const effectiveTitle = roles.length ? professionalRoleTitle(roles, customTitle) : "Cargo profesional pendiente";
  const needsLicense = rolesRequireLicense(roles);
  return <div className="profile-settings-layout">
    <aside className="profile-account-summary" aria-label="Resumen de la cuenta">
      <Avatar imageUrl={imageUrl} name={displayName} username={username} />
      <div className="min-w-0">
        <h2>{displayName || username}</h2>
        <p className="profile-professional-title">{effectiveTitle}</p>
        {needsLicense && licenseNumber ? <p className="profile-license-summary">Lic. {licenseNumber}</p> : null}
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
          <div className="space-y-1.5"><label htmlFor="displayName" className="text-sm font-semibold text-slate-800">Nombre visible</label><input id="displayName" name="displayName" className="input-premium" defaultValue={displayName} maxLength={100} autoComplete="name" required /></div>
          <RolePicker roles={roles} onChange={setRoles} customTitle={customTitle} onCustomTitleChange={setCustomTitle} />
          {needsLicense && <div className="space-y-1.5"><label htmlFor="professionalLicenseNumber" className="text-sm font-semibold text-slate-800">Número de licencia</label><input id="professionalLicenseNumber" name="professionalLicenseNumber" className="input-premium" value={licenseNumber} onChange={(event) => setLicenseNumber(event.target.value)} maxLength={80} required placeholder="Lic. C-XXXXX" /><p className="text-xs leading-5 text-slate-500">Se muestra solo como información profesional; no modifica permisos.</p></div>}
          {!needsLicense && <input type="hidden" name="professionalLicenseNumber" value="" />}
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
