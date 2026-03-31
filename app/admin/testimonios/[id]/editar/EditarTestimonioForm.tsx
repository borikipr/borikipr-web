"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  updateTestimonioAction,
  type UpdateTestimonioState,
} from "../../actions";
import ImagenesUploader from "@/app/admin/testimonios/ImagenesUploader";

type Props = {
  testimonio: {
    id: string;
    nombre: string;
    texto: string;
    ubicacion: string | null;
    foto_url: string | null;
    tipo: "comprador" | "vendedor";
    activo: boolean;
    destacado: boolean;
    orden: number;
  };
};

const initialState: UpdateTestimonioState = {
  error: "",
};

export default function EditarTestimonioForm({ testimonio }: Props) {
  const [state, formAction, pending] = useActionState(
    updateTestimonioAction,
    initialState
  );
  const [fotoUrl, setFotoUrl] = useState(testimonio.foto_url || "");

  const handleUploaded = (urls: string[]) => {
    if (urls[0]) {
      setFotoUrl(urls[0]);
    }
  };

  return (
    <div className="space-y-6">
      <ImagenesUploader onUploaded={handleUploaded} />

      <div className="surface-card p-8 md:p-10">
        <form action={formAction} className="space-y-8">
          <input type="hidden" name="id" value={testimonio.id} />

          <div className="grid gap-6 md:grid-cols-3">
            <div className="space-y-2">
              <label htmlFor="nombre" className="text-sm font-medium text-[#000000]">
                Nombre
              </label>
              <input
                id="nombre"
                name="nombre"
                type="text"
                defaultValue={testimonio.nombre}
                className="input-premium"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="ubicacion" className="text-sm font-medium text-[#000000]">
                Ubicación
              </label>
              <input
                id="ubicacion"
                name="ubicacion"
                type="text"
                defaultValue={testimonio.ubicacion || ""}
                className="input-premium"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="tipo" className="text-sm font-medium text-[#000000]">
                Tipo
              </label>
              <select
                id="tipo"
                name="tipo"
                defaultValue={testimonio.tipo}
                className="input-premium"
                required
              >
                <option value="comprador">Comprador</option>
                <option value="vendedor">Vendedor</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="texto" className="text-sm font-medium text-[#000000]">
              Testimonio
            </label>
            <textarea
              id="texto"
              name="texto"
              rows={6}
              defaultValue={testimonio.texto}
              className="input-premium"
              required
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="foto_url" className="text-sm font-medium text-[#000000]">
                Foto URL
              </label>
              <input
                id="foto_url"
                name="foto_url"
                type="text"
                value={fotoUrl}
                onChange={(e) => setFotoUrl(e.target.value)}
                className="input-premium"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="orden" className="text-sm font-medium text-[#000000]">
                Orden
              </label>
              <input
                id="orden"
                name="orden"
                type="number"
                min="0"
                defaultValue={testimonio.orden}
                className="input-premium"
              />
            </div>
          </div>

          {fotoUrl && (
            <div className="max-w-xs overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white">
              <img
                src={fotoUrl}
                alt="Preview testimonio"
                className="h-52 w-full object-cover"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-6">
            <label className="flex items-center gap-3">
              <input
                name="activo"
                type="checkbox"
                defaultChecked={testimonio.activo}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-[#000000]">Activo</span>
            </label>

            <label className="flex items-center gap-3">
              <input
                name="destacado"
                type="checkbox"
                defaultChecked={testimonio.destacado}
                className="h-4 w-4"
              />
              <span className="text-sm font-medium text-[#000000]">
                Destacado
              </span>
            </label>
          </div>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <div className="flex flex-wrap gap-4">
            <button
              type="submit"
              disabled={pending}
              className="btn-primary disabled:opacity-60"
            >
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>

            <Link href="/admin/testimonios" className="btn-secondary">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}