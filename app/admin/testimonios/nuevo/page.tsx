"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  createTestimonioAction,
  type CreateTestimonioState,
} from "../actions";
import ImagenesUploader from "@/app/admin/testimonios/ImagenesUploader";

const initialState: CreateTestimonioState = {
  error: "",
};

export default function NuevoTestimonioPage() {
  const [state, formAction, pending] = useActionState(
    createTestimonioAction,
    initialState
  );
  const [fotoUrl, setFotoUrl] = useState("");

  const handleUploaded = (urls: string[]) => {
    if (urls[0]) {
      setFotoUrl(urls[0]);
    }
  };

  return (
    <main className="min-h-screen bg-[#f8f8f8] px-6 py-10">
      <div className="section-shell">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow">Admin · Nuevo testimonio</p>
            <h1 className="mt-3 text-3xl font-bold text-[#000000]">
              Crear testimonio
            </h1>
            <p className="body-base mt-3">
              Añade una nueva opinión para reforzar la confianza del website.
            </p>
          </div>

          <Link href="/admin/testimonios" className="btn-secondary">
            Volver a testimonios
          </Link>
        </div>

        <div className="space-y-6">
          <ImagenesUploader onUploaded={handleUploaded} />

          <div className="surface-card p-8 md:p-10">
            <form action={formAction} className="space-y-8">
              <div className="grid gap-6 md:grid-cols-3">
                <div className="space-y-2">
                  <label htmlFor="nombre" className="text-sm font-medium text-[#000000]">
                    Nombre
                  </label>
                  <input
                    id="nombre"
                    name="nombre"
                    type="text"
                    placeholder="Nombre del cliente"
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
                    placeholder="Ponce, San Juan, etc."
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
                    className="input-premium"
                    required
                    defaultValue="comprador"
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
                  placeholder="Escribe aquí la opinión del cliente..."
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
                    placeholder="https://..."
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
                    defaultValue="0"
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
                    id="activo"
                    name="activo"
                    type="checkbox"
                    defaultChecked
                    className="h-4 w-4"
                  />
                  <span className="text-sm font-medium text-[#000000]">
                    Activo
                  </span>
                </label>

                <label className="flex items-center gap-3">
                  <input
                    id="destacado"
                    name="destacado"
                    type="checkbox"
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
                  {pending ? "Guardando..." : "Crear testimonio"}
                </button>

                <Link href="/admin/testimonios" className="btn-secondary">
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}