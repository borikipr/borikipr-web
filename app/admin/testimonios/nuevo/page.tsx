"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import Image from "next/image";
import {
  createTestimonioAction,
  getSiguienteOrdenAction,
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
  const [destacado, setDestacado] = useState(false);
  const [activo, setActivo] = useState(true);
  const [orden, setOrden] = useState(0);

  useEffect(() => {
    async function fetchOrden() {
      const nextOrden = await getSiguienteOrdenAction();
      setOrden(nextOrden);
    }
    fetchOrden();
  }, []);

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
                    Nombre <span className="text-red-500">*</span>
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
                  Testimonio <span className="text-red-500">*</span>
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
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setOrden(Math.max(0, orden - 1))}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d9d9d9] bg-white text-[#000000] transition hover:bg-[#f8f8f8]"
                    >
                      -
                    </button>
                    <input
                      id="orden"
                      name="orden"
                      type="number"
                      min="0"
                      value={orden}
                      onChange={(e) => setOrden(parseInt(e.target.value) || 0)}
                      className="input-premium w-24 text-center"
                    />
                    <button
                      type="button"
                      onClick={() => setOrden(orden + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#d9d9d9] bg-white text-[#000000] transition hover:bg-[#f8f8f8]"
                    >
                      +
                    </button>
                  </div>
                  <p className="text-xs text-[#4d4d4d]">
                    Define la posición en la lista (0 es el primero).
                  </p>
                </div>
              </div>

              {fotoUrl && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-[#000000]">
                    Previsualización del testimonio:
                  </p>
                  <div className="relative h-52 max-w-xs overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white shadow-sm">
                    {/* Botón eliminar */}
                    <button
                      type="button"
                      onClick={() => setFotoUrl("")}
                      className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600"
                      title="Quitar foto"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                    <Image
                      src={fotoUrl}
                      alt="Preview testimonio"
                      fill
                      sizes="(max-width: 768px) 100vw, 320px"
                      className="object-cover"
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-10">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#000000]">
                    Estado
                  </label>
                  <div className="flex h-10 items-center gap-3">
                    <input
                      type="hidden"
                      name="activo"
                      value={activo ? "on" : ""}
                    />
                    <button
                      type="button"
                      onClick={() => setActivo(!activo)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        activo ? "bg-[#11518b]" : "bg-[#d9d9d9]"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          activo ? "translate-x-5" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <span className={`text-sm font-medium ${activo ? "text-[#11518b]" : "text-[#4d4d4d]"}`}>
                      {activo ? "Visible en la web" : "Oculto"}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-[#000000]">
                    Destacado
                  </label>
                  <div className="flex h-10 items-center">
                    <input
                      type="hidden"
                      name="destacado"
                      value={destacado ? "on" : ""}
                    />
                    <button
                      type="button"
                      onClick={() => setDestacado(!destacado)}
                      className={`flex h-10 w-40 items-center justify-center gap-2 rounded-xl border transition-all duration-300 ${
                        destacado
                          ? "border-[#d4af37] bg-[#fff9e6] text-[#d4af37] shadow-sm"
                          : "border-[#d9d9d9] bg-white text-[#4d4d4d] hover:border-[#d4af37] hover:text-[#d4af37]"
                      }`}
                    >
                      <svg
                        className={`h-5 w-5 ${destacado ? "fill-current" : "fill-none"}`}
                        stroke="currentColor"
                        strokeWidth={2}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                        />
                      </svg>
                      <span className="text-sm font-semibold">
                        {destacado ? "Destacado" : "Normal"}
                      </span>
                    </button>
                  </div>
                </div>
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