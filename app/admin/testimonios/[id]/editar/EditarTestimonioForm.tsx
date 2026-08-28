"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import Image from "next/image";
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
  const [destacado, setDestacado] = useState(testimonio.destacado);
  const [activo, setActivo] = useState(testimonio.activo);
  const [orden, setOrden] = useState(testimonio.orden);

  const handleUploaded = (urls: string[]) => {
    if (urls[0]) {
      setFotoUrl(urls[0]);
    }
  };

  return (
    <div className="testimonial-editor-shell">
      <form action={formAction} className="testimonial-editor-form">
          <input type="hidden" name="id" value={testimonio.id} />

          <section className="testimonial-editor-section" aria-labelledby="testimonial-main-heading">
            <div className="testimonial-editor-section-heading"><h2 id="testimonial-main-heading">Información principal</h2><p>Identifica a la persona y el contexto que acompaña su experiencia.</p></div>
          <div className="testimonial-editor-grid">
            <div className="space-y-2">
              <label htmlFor="nombre" className="text-sm font-medium text-[#000000]">
                Nombre <span className="text-red-500">*</span>
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
          </section>

          <section className="testimonial-editor-section" aria-labelledby="testimonial-copy-heading">
            <div className="testimonial-editor-section-heading"><h2 id="testimonial-copy-heading">Testimonio</h2><p>Este es el texto principal que se mostrará en el website cuando esté publicado.</p></div>
          <div className="space-y-2">
            <label htmlFor="texto" className="text-sm font-medium text-[#000000]">
              Testimonio <span className="text-red-500">*</span>
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
          </section>

          <section className="testimonial-editor-section" aria-labelledby="testimonial-image-heading">
            <input name="foto_url" type="hidden" value={fotoUrl} />
            <div className="testimonial-editor-section-heading"><h2 id="testimonial-image-heading">Imagen</h2><p>Añade o reemplaza el retrato asociado al testimonio.</p></div>
            <ImagenesUploader onUploaded={handleUploaded} />

          {fotoUrl && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-slate-900">Imagen actual</p>
              <div className="testimonial-image-preview">
                <button
                  type="button"
                  onClick={() => setFotoUrl("")}
                  aria-label="Quitar imagen"
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
          </section>

          <section className="testimonial-editor-section" aria-labelledby="testimonial-publication-heading">
            <div className="testimonial-editor-section-heading"><h2 id="testimonial-publication-heading">Publicación</h2><p>Controla la visibilidad, prioridad y orden en el website.</p></div>
          <div className="testimonial-editor-options">
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
                  aria-label={activo ? "Ocultar del website" : "Publicar en el website"}
                  aria-pressed={activo}
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
                </span >
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
                  aria-pressed={destacado}
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
            <div className="space-y-2">
              <label htmlFor="orden" className="text-sm font-medium text-[#000000]">Orden</label>
              <div className="flex items-center gap-2">
                <button type="button" aria-label="Reducir orden" onClick={() => setOrden(Math.max(0, orden - 1))} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50">−</button>
                <input id="orden" name="orden" type="number" min="0" value={orden} onChange={(e) => setOrden(parseInt(e.target.value) || 0)} className="input-premium w-20 text-center" />
                <button type="button" aria-label="Aumentar orden" onClick={() => setOrden(orden + 1)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50">+</button>
              </div>
            </div>
          </div>
          </section>

          {state.error && (
            <p className="text-sm text-red-600">{state.error}</p>
          )}

          <div className="testimonial-editor-actions">
            <p className="text-sm text-slate-500">Los cambios se reflejan en el Admin y, si está publicado, en el website.</p>
            <div className="flex flex-wrap gap-3">
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
          </div>
        </form>
    </div>
  );
}
