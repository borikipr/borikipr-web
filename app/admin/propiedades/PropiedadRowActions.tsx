"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ExternalLink, FilePenLine, KeyRound, Link2, Star, StarOff, Trash2 } from "lucide-react";
import { AdminActionDialog, AdminActionsMenu, AdminMenuItem } from "@/components/admin/AdminActionsMenu";
import { deletePropiedadAction, toggleDestacadoAction, updatePropiedadEstadoAction } from "./actions";

type EstadoPropiedad = "disponible" | "coming_soon" | "bajo_contrato" | "vendida" | "rentada";
type Props = { id: string; slug: string; titulo: string; estadoActual: EstadoPropiedad; destacadoActual: boolean };

export default function PropiedadRowActions({ id, slug, titulo, estadoActual, destacadoActual }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [privateLinkOpen, setPrivateLinkOpen] = useState(false);
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const [privateLink, setPrivateLink] = useState("");
  const [privateLinkError, setPrivateLinkError] = useState("");
  const [privateLinkPending, setPrivateLinkPending] = useState(false);

  const loadPrivateLink = async () => {
    setPrivateLinkOpen(true);
    if (privateLink) return;
    setPrivateLinkPending(true);
    setPrivateLinkError("");
    try {
      const response = await fetch(`/api/admin/propiedades/${id}/private-showing-link`, { cache: "no-store" });
      const result = (await response.json()) as { url?: string };
      if (!response.ok || !result.url) throw new Error("link_unavailable");
      setPrivateLink(result.url);
    } catch {
      setPrivateLinkError("No se pudo obtener el enlace privado.");
    } finally {
      setPrivateLinkPending(false);
    }
  };

  const regeneratePrivateLink = async () => {
    setPrivateLinkPending(true);
    setPrivateLinkError("");
    try {
      const response = await fetch(`/api/admin/propiedades/${id}/private-showing-link`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation: "REGENERAR" }),
      });
      const result = (await response.json()) as { url?: string };
      if (!response.ok || !result.url) throw new Error("regeneration_failed");
      setPrivateLink(result.url);
      setRegenerateOpen(false);
      setPrivateLinkOpen(true);
    } catch {
      setPrivateLinkError("No se pudo regenerar el enlace privado.");
      setRegenerateOpen(false);
      setPrivateLinkOpen(true);
    } finally {
      setPrivateLinkPending(false);
    }
  };

  const handleEstadoChange = (nextEstado: EstadoPropiedad) => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("estado", nextEstado);
    startTransition(async () => {
      try { await updatePropiedadEstadoAction(formData); }
      catch (error) { console.error(error); alert("No se pudo actualizar el estado."); }
    });
  };

  const handleToggleDestacado = () => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("destacado", String(!destacadoActual));
    startTransition(async () => {
      try { await toggleDestacadoAction(formData); }
      catch (error) { console.error(error); alert("No se pudo actualizar el estado de destacado."); }
    });
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("confirmacion", "BORRAR");
    startTransition(async () => {
      try { await deletePropiedadAction(formData); setDeleteOpen(false); }
      catch (error) { console.error(error); alert("No se pudo borrar la propiedad."); }
    });
  };

  return (
    <>
      <div className="property-row-actions">
        <button type="button" className="property-edit-action" onClick={() => router.push(`/admin/propiedades/${id}/editar`)}>
          <FilePenLine aria-hidden="true" size={17} /> Editar
        </button>
        <AdminActionsMenu label={`Acciones de ${titulo}`} compact>
          <AdminMenuItem icon={<ExternalLink size={17} />} onSelect={() => window.open(`/listados/${slug}`, "_blank", "noopener,noreferrer")}>
            Ver en sitio
          </AdminMenuItem>
          <AdminMenuItem icon={<Link2 size={17} />} onSelect={() => void loadPrivateLink()}>
            Enlace privado de visita
          </AdminMenuItem>
          <AdminMenuItem disabled={isPending} icon={destacadoActual ? <StarOff size={17} /> : <Star size={17} />} onSelect={handleToggleDestacado}>
            {destacadoActual ? "Quitar destacado" : "Marcar como destacado"}
          </AdminMenuItem>
          <div className="admin-actions-control">
            <label htmlFor={`property-status-${id}`}><KeyRound aria-hidden="true" size={16} /> Estado</label>
            <select id={`property-status-${id}`} value={estadoActual} disabled={isPending} onChange={(event) => handleEstadoChange(event.target.value as EstadoPropiedad)}>
              <option value="disponible">Disponible</option>
              <option value="coming_soon">Próximamente</option>
              <option value="bajo_contrato">Bajo contrato</option>
              <option value="vendida">Vendida</option>
              <option value="rentada">Alquilada</option>
            </select>
          </div>
          <div className="admin-actions-separator" />
          <AdminMenuItem danger disabled={isPending} icon={<Trash2 size={17} />} onSelect={() => setDeleteOpen(true)}>
            Eliminar propiedad
          </AdminMenuItem>
        </AdminActionsMenu>
      </div>

      <AdminActionDialog open={privateLinkOpen} onClose={() => setPrivateLinkOpen(false)} title="Enlace privado de visita" description="Comparte el formulario privado asociado a esta propiedad.">
        {privateLinkPending && <p className="text-sm text-slate-600">Preparando enlace…</p>}
        {privateLink && <div className="grid gap-3">
          <p className="break-all rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">{privateLink}</p>
          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn-primary" onClick={() => void navigator.clipboard.writeText(privateLink)}>Copiar enlace</button>
            <a href={privateLink} target="_blank" rel="noopener noreferrer" className="btn-secondary">Abrir formulario</a>
          </div>
          <button type="button" className="justify-self-start text-sm font-semibold text-red-700" onClick={() => { setPrivateLinkOpen(false); setRegenerateOpen(true); }}>
            Regenerar enlace privado
          </button>
        </div>}
        {privateLinkError && <p role="alert" className="text-sm text-red-700">{privateLinkError}</p>}
      </AdminActionDialog>

      <AdminActionDialog open={regenerateOpen} onClose={() => setRegenerateOpen(false)} title="Regenerar enlace privado" description="El enlace anterior dejará de funcionar inmediatamente." danger>
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setRegenerateOpen(false)}>Cancelar</button>
          <button type="button" className="admin-danger-button" disabled={privateLinkPending} onClick={() => void regeneratePrivateLink()}>{privateLinkPending ? "Regenerando…" : "Regenerar enlace"}</button>
        </div>
      </AdminActionDialog>

      <AdminActionDialog open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Eliminar propiedad" description={`Se eliminará “${titulo}” y dejará de aparecer en el inventario y el sitio público.`} danger>
        <p className="text-sm text-slate-700">Esta acción no se puede deshacer.</p>
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button type="button" className="btn-secondary" onClick={() => setDeleteOpen(false)}>Cancelar</button>
          <button type="button" className="admin-danger-button" disabled={isPending} onClick={handleDelete}>{isPending ? "Eliminando…" : "Eliminar propiedad"}</button>
        </div>
      </AdminActionDialog>
    </>
  );
}
