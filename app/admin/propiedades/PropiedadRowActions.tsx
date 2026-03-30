"use client";

import { useState, useTransition } from "react";
import {
  deletePropiedadAction,
  updatePropiedadEstadoAction,
} from "./actions";

type EstadoPropiedad =
  | "disponible"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

type Props = {
  id: string;
  estadoActual: EstadoPropiedad;
};

export default function PropiedadRowActions({
  id,
  estadoActual,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);

  const handleEstadoChange = (nextEstado: string) => {
    const formData = new FormData();
    formData.set("id", id);
    formData.set("estado", nextEstado);

    startTransition(async () => {
      try {
        await updatePropiedadEstadoAction(formData);
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
        await deletePropiedadAction(formData);
      } catch (error) {
        console.error(error);
        alert("No se pudo borrar la propiedad.");
      }
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          defaultValue={estadoActual}
          onChange={(e) => handleEstadoChange(e.target.value)}
          disabled={isPending}
          className="rounded-xl border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#4d4d4d] disabled:opacity-60"
        >
          <option value="disponible">Disponible</option>
          <option value="bajo_contrato">Bajo contrato</option>
          <option value="vendida">Vendida</option>
          <option value="rentada">Rentada</option>
        </select>

        {!confirmandoBorrado ? (
          <button
            type="button"
            onClick={() => setConfirmandoBorrado(true)}
            disabled={isPending}
            className="text-sm font-medium text-red-600 transition hover:text-red-700 disabled:opacity-60"
          >
            {isPending ? "Procesando..." : "Borrar"}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2">
            <span className="text-sm text-red-700">
              ¿Seguro que quieres borrarla?
            </span>

            <button
              type="button"
              onClick={handleDelete}
              disabled={isPending}
              className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {isPending ? "Borrando..." : "Sí, borrar"}
            </button>

            <button
              type="button"
              onClick={() => setConfirmandoBorrado(false)}
              disabled={isPending}
              className="rounded-full border border-[#d9d9d9] bg-white px-3 py-1.5 text-xs font-semibold text-[#4d4d4d] transition hover:bg-[#f8f8f8] disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}