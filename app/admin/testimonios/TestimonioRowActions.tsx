"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Pencil, Star, Trash2 } from "lucide-react";
import { AdminActionDialog, AdminActionsMenu, AdminMenuItem } from "@/components/admin/AdminActionsMenu";
import {
  deleteTestimonioAction,
  updateTestimonioActivoAction,
  toggleTestimonioDestacadoAction,
} from "./actions";

type Props = {
  id: string;
  activoActual: boolean;
  destacadoActual: boolean;
};

export default function TestimonioRowActions({
  id,
  activoActual,
  destacadoActual,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const handleActivoChange = (nextActivo: boolean) => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("activo", String(nextActivo));

    startTransition(async () => {
      try {
        await updateTestimonioActivoAction(formData);
        router.refresh();
      } catch (error) {
        console.error(error);
        alert("No se pudo actualizar el estado.");
      }
    });
  };

  const handleDelete = () => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("confirmacion", "BORRAR");

    startTransition(async () => {
      try {
        await deleteTestimonioAction(formData);
        setConfirmandoBorrado(false);
        router.push("/admin/testimonios?ok=deleted");
        router.refresh();
      } catch (error) {
        console.error(error);
        alert("No se pudo borrar el testimonio.");
      }
    });
  };

  const handleToggleDestacado = () => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("destacado", String(!destacadoActual));

    startTransition(async () => {
      try {
        await toggleTestimonioDestacadoAction(formData);
        router.refresh();
      } catch (error) {
        console.error(error);
        alert("No se pudo actualizar el estado de destacado.");
      }
    });
  };

  return <>
    <AdminActionsMenu compact label="Acciones del testimonio">
      <Link href={`/admin/testimonios/${id}/editar`} role="menuitem" className="admin-actions-item"><span aria-hidden="true"><Pencil size={16} /></span><span>Editar</span></Link>
      <AdminMenuItem icon={activoActual ? <EyeOff size={16} /> : <Eye size={16} />} onSelect={() => handleActivoChange(!activoActual)} disabled={isPending}>{activoActual ? "Ocultar del website" : "Publicar en el website"}</AdminMenuItem>
      <AdminMenuItem icon={<Star size={16} />} onSelect={handleToggleDestacado} disabled={isPending}>{destacadoActual ? "Quitar destacado" : "Marcar como destacado"}</AdminMenuItem>
      <div className="admin-actions-separator" role="separator" />
      <AdminMenuItem icon={<Trash2 size={16} />} danger onSelect={() => setConfirmandoBorrado(true)} disabled={isPending}>Eliminar</AdminMenuItem>
    </AdminActionsMenu>
    <AdminActionDialog open={confirmandoBorrado} onClose={() => setConfirmandoBorrado(false)} danger title="Eliminar testimonio" description="Esta acción eliminará el testimonio y su referencia en el Admin. No se puede deshacer.">
      <div className="flex flex-wrap justify-end gap-3"><button type="button" className="btn-secondary" onClick={() => setConfirmandoBorrado(false)} disabled={isPending}>Cancelar</button><button type="button" onClick={handleDelete} disabled={isPending} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">{isPending ? "Eliminando…" : "Eliminar testimonio"}</button></div>
    </AdminActionDialog>
  </>;
}
