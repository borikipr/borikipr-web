"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import Image from "next/image";
import { municipiosPR } from "@/data/municipios";
import { updatePropiedadAction, type UpdatePropiedadState } from "../../actions";
import ImagenesUploader from "../../ImagenesUploader";

type EditarPropiedadFormProps = {
  propiedad: {
    id: string;
    slug: string;
    titulo: string;
    descripcion: string;
    municipio: string;
    precio: string | number;
    tipo_negocio: "venta" | "renta";
    tipo_propiedad: "Casa" | "Apartamento" | "Condominio" | "Terreno" | "Comercial";
    habitaciones: number;
    banos: number;
    estacionamientos: number;
    metros_cuadrados: number;
    estado: "disponible" | "bajo_contrato" | "vendida" | "rentada";
    destacado: boolean;
    imagenes: string[];
    origen_listado: "propio" | "co_broke" | "externo";
    corredor_colaborador_nombre?: string;
    corredor_colaborador_empresa?: string;
    corredor_colaborador_contacto?: string;
    enlace_original?: string;
    permiso_publicar_web: boolean;
    permiso_usar_fotos: boolean;
    notas_internas?: string;
  };
};

const initialState: UpdatePropiedadState = {
  error: "",
};

export default function EditarPropiedadForm({
  propiedad,
}: EditarPropiedadFormProps) {
  const [state, formAction, pending] = useActionState(
    updatePropiedadAction,
    initialState
  );
  const [imagenesValue, setImagenesValue] = useState(propiedad.imagenes.join(", "));
  const [destacado, setDestacado] = useState(propiedad.destacado);
  const [origenListado, setOrigenListado] = useState<"propio" | "co_broke" | "externo">(propiedad.origen_listado);

  const imagenesPreview = useMemo(
    () =>
      imagenesValue
        .split(",")
        .map((img) => img.trim())
        .filter(Boolean),
    [imagenesValue]
  );

  const handleUploaded = (urls: string[]) => {
    setImagenesValue((prev) => {
      const current = prev
        .split(",")
        .map((img) => img.trim())
        .filter(Boolean);

      const merged = [...current, ...urls];
      return merged.join(", ");
    });
  };

  return (
    <div className="space-y-6">
      <ImagenesUploader onUploaded={handleUploaded} />

      <div className="surface-card p-8 md:p-10">
        <form action={formAction} className="space-y-8">
          <input type="hidden" name="id" value={propiedad.id} />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="slug" className="text-sm font-medium text-[#000000]">
                Slug <span className="text-red-500">*</span>
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                defaultValue={propiedad.slug}
                className="input-premium"
                required
              />
              <p className="text-xs text-[#4d4d4d]">
                Identificador único para la URL (solo letras, números y guiones).
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="titulo" className="text-sm font-medium text-[#000000]">
                Título <span className="text-red-500">*</span>
              </label>
              <input
                id="titulo"
                name="titulo"
                type="text"
                defaultValue={propiedad.titulo}
                className="input-premium"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="descripcion" className="text-sm font-medium text-[#000000]">
              Descripción <span className="text-red-500">*</span>
            </label>
            <textarea
              id="descripcion"
              name="descripcion"
              rows={6}
              defaultValue={propiedad.descripcion}
              className="input-premium"
              required
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2">
              <label htmlFor="municipio" className="text-sm font-medium text-[#000000]">
                Municipio
              </label>
              <select
                id="municipio"
                name="municipio"
                defaultValue={propiedad.municipio}
                className="input-premium"
                required
              >
                <option value="">Selecciona municipio</option>
                {municipiosPR.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="precio" className="text-sm font-medium text-[#000000]">
                Precio <span className="text-red-500">*</span>
              </label>
              <input
                id="precio"
                name="precio"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(propiedad.precio)}
                className="input-premium"
                required
              />
              <p className="text-xs text-[#4d4d4d]">
                Ej: 350000 (sin comas ni símbolos).
              </p>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="tipo_negocio"
                className="text-sm font-medium text-[#000000]"
              >
                Tipo de negocio
              </label>
              <select
                id="tipo_negocio"
                name="tipo_negocio"
                defaultValue={propiedad.tipo_negocio}
                className="input-premium"
                required
              >
                <option value="venta">Venta</option>
                <option value="renta">Alquiler</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="tipo_propiedad"
                className="text-sm font-medium text-[#000000]"
              >
                Tipo de propiedad
              </label>
              <select
                id="tipo_propiedad"
                name="tipo_propiedad"
                defaultValue={propiedad.tipo_propiedad}
                className="input-premium"
                required
              >
                <option value="Casa">Casa</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Condominio">Condominio</option>
                <option value="Terreno">Terreno</option>
                <option value="Comercial">Comercial</option>
              </select>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-6">
            <div className="space-y-2">
              <label
                htmlFor="habitaciones"
                className="text-sm font-medium text-[#000000]"
              >
                Habitaciones
              </label>
              <input
                id="habitaciones"
                name="habitaciones"
                type="number"
                min="0"
                defaultValue={propiedad.habitaciones}
                className="input-premium"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="banos" className="text-sm font-medium text-[#000000]">
                Baños
              </label>
              <input
                id="banos"
                name="banos"
                type="number"
                min="0"
                defaultValue={propiedad.banos}
                className="input-premium"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="estacionamientos"
                className="text-sm font-medium text-[#000000]"
              >
                Estacionamientos
              </label>
              <input
                id="estacionamientos"
                name="estacionamientos"
                type="number"
                min="0"
                defaultValue={propiedad.estacionamientos}
                className="input-premium"
              />
            </div>

            <div className="space-y-2">
              <label
                htmlFor="metros_cuadrados"
                className="text-sm font-medium text-[#000000]"
              >
                Metros cuadrados
              </label>
              <input
                id="metros_cuadrados"
                name="metros_cuadrados"
                type="number"
                min="0"
                defaultValue={propiedad.metros_cuadrados}
                className="input-premium"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="estado" className="text-sm font-medium text-[#000000]">
                Estado
              </label>
              <select
                id="estado"
                name="estado"
                defaultValue={propiedad.estado}
                className="input-premium"
                required
              >
                <option value="disponible">Disponible</option>
                <option value="bajo_contrato">Bajo contrato</option>
                <option value="vendida">Vendida</option>
                <option value="rentada">Alquilada</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-[#000000]">
                Destacado
              </label>
              <div className="flex h-[46px] items-center">
                <input
                  type="hidden"
                  name="destacado"
                  value={destacado ? "on" : ""}
                />
                <button
                  type="button"
                  onClick={() => setDestacado(!destacado)}
                  className={`flex h-10 w-full items-center justify-center gap-2 rounded-xl border transition-all duration-300 ${
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

          <div className="space-y-2">
            <label
              htmlFor="origen_listado"
              className="text-sm font-medium text-[#000000]"
            >
              Origen del listado <span className="text-red-500">*</span>
            </label>
            <select
              id="origen_listado"
              name="origen_listado"
              value={origenListado}
              onChange={(e) => setOrigenListado(e.target.value as "propio" | "co_broke" | "externo")}
              className="input-premium"
              required
            >
              <option value="propio">Listado propio</option>
              <option value="co_broke">Propiedad en colaboración / Co-Broke</option>
              <option value="externo">Externo / referencia</option>
            </select>
          </div>

          {(origenListado === "co_broke" || origenListado === "externo") && (
            <div className="space-y-6 rounded-2xl border border-[#d4af37]/30 bg-[#fff9e6]/50 p-6">
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#d4af37] text-sm font-bold text-white">
                  ℹ
                </div>
                <p className="text-sm text-[#4d4d4d]">
                  Información del corredor colaborador para esta propiedad.
                </p>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <label
                    htmlFor="corredor_colaborador_nombre"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Nombre del corredor colaborador <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="corredor_colaborador_nombre"
                    name="corredor_colaborador_nombre"
                    type="text"
                    defaultValue={propiedad.corredor_colaborador_nombre || ""}
                    placeholder="Ej: Carlos Rodríguez"
                    className="input-premium"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="corredor_colaborador_empresa"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Compañía u oficina
                  </label>
                  <input
                    id="corredor_colaborador_empresa"
                    name="corredor_colaborador_empresa"
                    type="text"
                    defaultValue={propiedad.corredor_colaborador_empresa || ""}
                    placeholder="Ej: Realty Group PR"
                    className="input-premium"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="corredor_colaborador_contacto"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Contacto interno del corredor
                  </label>
                  <input
                    id="corredor_colaborador_contacto"
                    name="corredor_colaborador_contacto"
                    type="text"
                    defaultValue={propiedad.corredor_colaborador_contacto || ""}
                    placeholder="Ej: carlos@realty.com o +1-787-555-0123"
                    className="input-premium"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="enlace_original"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Enlace original del anuncio
                  </label>
                  <input
                    id="enlace_original"
                    name="enlace_original"
                    type="url"
                    defaultValue={propiedad.enlace_original || ""}
                    placeholder="https://..."
                    className="input-premium"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-[#000000]">
                  Permisos de publicación
                </label>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="permiso_publicar_web"
                      name="permiso_publicar_web"
                      defaultChecked={propiedad.permiso_publicar_web}
                      className="h-4 w-4 rounded border-[#d9d9d9] text-[#d4af37]"
                    />
                    <label htmlFor="permiso_publicar_web" className="text-sm text-[#4d4d4d]">
                      Permiso para publicar en website
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="permiso_usar_fotos"
                      name="permiso_usar_fotos"
                      defaultChecked={propiedad.permiso_usar_fotos}
                      className="h-4 w-4 rounded border-[#d9d9d9] text-[#d4af37]"
                    />
                    <label htmlFor="permiso_usar_fotos" className="text-sm text-[#4d4d4d]">
                      Permiso para usar fotos
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="notas_internas"
                  className="text-sm font-medium text-[#000000]"
                >
                  Notas internas
                </label>
                <textarea
                  id="notas_internas"
                  name="notas_internas"
                  rows={3}
                  defaultValue={propiedad.notas_internas || ""}
                  placeholder="Información adicional, acuerdos especiales, etc. (no se mostrará públicamente)"
                  className="input-premium"
                />
              </div>
            </div>
          )}

          <div className="space-y-3">
            <label htmlFor="imagenes" className="text-sm font-medium text-[#000000]">
              Imágenes
            </label>
            <textarea
              id="imagenes"
              name="imagenes"
              rows={4}
              value={imagenesValue}
              onChange={(e) => setImagenesValue(e.target.value)}
              className="input-premium"
            />
            <p className="text-sm text-[#4d4d4d]">
              Puedes subir nuevas imágenes arriba o pegar URLs manualmente.
            </p>
          </div>

          {imagenesPreview.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {imagenesPreview.map((url) => {
                const esVideo = /\.(mp4|webm|mov)(\?|$)/i.test(url) || url.includes("/videos/");
                return (
                  <div
                    key={url}
                    className="relative overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white"
                  >
                    {/* Botón eliminar */}
                    <button
                      type="button"
                      onClick={() => {
                        const urls = imagenesPreview.filter((u) => u !== url);
                        setImagenesValue(urls.join(", "));
                      }}
                      className="absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition hover:bg-red-600"
                      title="Quitar imagen"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>

                    {esVideo ? (
                      <div className="relative h-40 w-full bg-black">
                        <video
                          src={url}
                          className="h-full w-full object-cover"
                          muted
                          playsInline
                          preload="metadata"
                        />
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80">
                            <svg className="h-5 w-5 text-[#11518b] ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                        <span className="absolute top-2 left-2 rounded-full bg-[#11518b] px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                          Video
                        </span>
                      </div>
                    ) : (
                      <div className="relative h-40 w-full">
                        <Image
                          src={url}
                          alt="Preview"
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="break-all text-xs text-[#4d4d4d]">{url}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {state.error && <p className="text-sm text-red-600">{state.error}</p>}

          <div className="flex flex-wrap gap-4">
            <button
              type="submit"
              disabled={pending}
              className="btn-primary disabled:opacity-60"
            >
              {pending ? "Guardando..." : "Guardar cambios"}
            </button>

            <Link href="/admin/propiedades" className="btn-secondary">
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
