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
    estado: "disponible" | "coming_soon" | "bajo_contrato" | "vendida" | "rentada";
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
    configuracion_formulario?: Record<string, unknown> | null;
    tiene_placas_solares?: boolean | null;
    cantidad_placas?: number | null;
    placas_en_lease?: boolean | null;
    requiere_precalificacion?: boolean | null;
    acepta_cdbg?: boolean | null;
    fecha_showing?: string | null;
    pregunta_personalizada?: string | null;
    formulario_showing_activo: boolean;
  };
};

const initialState: UpdatePropiedadState = {
  error: "",
};

function buildDescriptionTemplate({
  municipio,
  tipoNegocio,
  tipoPropiedad,
  estado,
}: {
  municipio: string;
  tipoNegocio: string;
  tipoPropiedad: string;
  estado: string;
}) {
  const location = municipio ? `${municipio}, Puerto Rico` : "Puerto Rico";
  const propertyType = tipoPropiedad ? `${tipoPropiedad.toLowerCase()} ` : "";

  if (estado === "coming_soon") {
    return `Propiedad próximamente disponible en ${location}. Actualmente se encuentra en proceso de preparación para salir al mercado. Para más información o para registrar tu interés, comunícate con Erickson Real Estate.`;
  }

  if (tipoNegocio === "renta") {
    return `${propertyType}disponible para alquiler en ${location}. Ideal para quienes buscan una opción cómoda y bien ubicada. Para más información o coordinar una visita, comunícate con Erickson Real Estate.`;
  }

  return `Excelente oportunidad de compra en ${location}. Esta ${propertyType || "propiedad "}ofrece una alternativa ideal para quienes buscan comodidad, ubicación y potencial. Para más información o coordinar una visita, comunícate con Erickson Real Estate.`;
}

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
  const [showingActivo, setShowingActivo] = useState(propiedad.formulario_showing_activo);
  const [tienePlacas, setTienePlacas] = useState(Boolean(propiedad.tiene_placas_solares));
  const [descripcion, setDescripcion] = useState(propiedad.descripcion);
  const [municipio, setMunicipio] = useState(propiedad.municipio);
  const [tipoNegocio, setTipoNegocio] = useState(propiedad.tipo_negocio);
  const [tipoPropiedad, setTipoPropiedad] = useState(propiedad.tipo_propiedad);
  const [estado, setEstado] = useState(propiedad.estado);

  const fechaShowing = propiedad.fecha_showing ? new Date(propiedad.fecha_showing) : null;
  const fechaShowingValue = fechaShowing && !Number.isNaN(fechaShowing.getTime())
    ? fechaShowing.toISOString().slice(0, 10)
    : "";
  const horaShowingValue = fechaShowing && !Number.isNaN(fechaShowing.getTime())
    ? fechaShowing.toTimeString().slice(0, 5)
    : "";
  const notasCompradores =
    typeof propiedad.configuracion_formulario?.notas_compradores === "string"
      ? propiedad.configuracion_formulario.notas_compradores
      : "";

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

  const handleDescriptionTemplate = () => {
    if (
      descripcion.trim() &&
      !window.confirm("Esto reemplazará la descripción actual. ¿Deseas continuar?")
    ) {
      return;
    }

    setDescripcion(
      buildDescriptionTemplate({
        municipio,
        tipoNegocio,
        tipoPropiedad,
        estado,
      })
    );
  };

  return (
    <div className="space-y-6">
      <ImagenesUploader onUploaded={handleUploaded} />

      <div className="surface-card p-8 md:p-10">
        <form action={formAction} className="space-y-8">
          <input type="hidden" name="id" value={propiedad.id} />
          <input type="hidden" name="slug" value={propiedad.slug} />

          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-[#000000]">
                URL actual
              </p>
              <div className="flex min-h-[46px] items-center rounded-xl border border-[#d9d9d9] bg-[#f8f8f8] px-4 py-3 text-sm text-[#4d4d4d]">
                borikipr.com/listados/{propiedad.slug}
              </div>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="descripcion" className="text-sm font-medium text-[#000000]">
                Descripción <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={handleDescriptionTemplate}
                className="inline-flex items-center justify-center rounded-full border border-[#11518b] px-4 py-2 text-xs font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
              >
                {descripcion.trim() ? "Reemplazar con plantilla" : "Generar descripción base"}
              </button>
            </div>
            <textarea
              id="descripcion"
              name="descripcion"
              rows={6}
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
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
                value={municipio}
                onChange={(e) => setMunicipio(e.target.value)}
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
                Precio
              </label>
              <input
                id="precio"
                name="precio"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(propiedad.precio) > 0 ? Number(propiedad.precio) : ""}
                className="input-premium"
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
                value={tipoNegocio}
                onChange={(e) => setTipoNegocio(e.target.value as "venta" | "renta")}
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
                value={tipoPropiedad}
                onChange={(e) => setTipoPropiedad(e.target.value as typeof tipoPropiedad)}
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
                value={estado}
                onChange={(e) => setEstado(e.target.value as typeof estado)}
                className="input-premium"
                required
              >
                <option value="disponible">Disponible</option>
                <option value="coming_soon">Coming Soon (Próximamente)</option>
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
            {origenListado === "externo" && (
              <input type="hidden" name="origen_listado" value="externo" />
            )}
            <select
              id="origen_listado"
              name={origenListado === "externo" ? undefined : "origen_listado"}
              value={origenListado}
              onChange={(e) => setOrigenListado(e.target.value as "propio" | "co_broke")}
              className="input-premium"
              disabled={origenListado === "externo"}
              required
            >
              <option value="propio">Listado propio</option>
              <option value="co_broke">Propiedad en colaboración / Co-Broke</option>
              {origenListado === "externo" && (
                <option value="externo">Externo / referencia</option>
              )}
            </select>
            {origenListado === "externo" && (
              <p className="text-sm text-[#4d4d4d]">
                Origen legado. Esta opciÃ³n ya no estÃ¡ disponible para nuevos listados.
              </p>
            )}
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
                    Nombre del corredor colaborador{" "}
                    {origenListado === "co_broke" && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <input
                    id="corredor_colaborador_nombre"
                    name="corredor_colaborador_nombre"
                    type="text"
                    defaultValue={propiedad.corredor_colaborador_nombre || ""}
                    placeholder="Ej: Carlos Rodríguez"
                    className="input-premium"
                    required={origenListado === "co_broke"}
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

          <div className="space-y-6 rounded-2xl border border-[#11518b]/20 bg-[#f7fbff] p-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#11518b]">
                Formulario de showing/open house
              </p>
              <p className="mt-2 text-sm text-[#4d4d4d]">
                Activalo solo cuando haya una fecha y hora confirmada para recibir perfiles de compradores.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                id="formulario_showing_activo"
                type="checkbox"
                name="formulario_showing_activo"
                checked={showingActivo}
                onChange={(e) => setShowingActivo(e.target.checked)}
                className="h-4 w-4 rounded border-[#d9d9d9] accent-[#11518b]"
              />
              <label htmlFor="formulario_showing_activo" className="text-sm font-medium text-[#000000]">
                Activar formulario para showing/open house
              </label>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              <div className="space-y-2">
                <label htmlFor="fecha_showing_fecha" className="text-sm font-medium text-[#000000]">
                  Fecha del showing/open house
                </label>
                <input
                  id="fecha_showing_fecha"
                  name="fecha_showing_fecha"
                  type="date"
                  defaultValue={fechaShowingValue}
                  className="input-premium"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="fecha_showing_hora" className="text-sm font-medium text-[#000000]">
                  Hora del showing/open house
                </label>
                <input
                  id="fecha_showing_hora"
                  name="fecha_showing_hora"
                  type="time"
                  defaultValue={horaShowingValue}
                  className="input-premium"
                />
              </div>

              <div className="flex items-center gap-3 pt-7">
                <input
                  id="requiere_precalificacion"
                  name="requiere_precalificacion"
                  type="checkbox"
                  defaultChecked={Boolean(propiedad.requiere_precalificacion)}
                  className="h-4 w-4 rounded border-[#d9d9d9] accent-[#11518b]"
                />
                <label htmlFor="requiere_precalificacion" className="text-sm text-[#4d4d4d]">
                  Requiere carta de preaprobacion
                </label>
              </div>

              <div className="flex items-center gap-3 pt-7">
                <input
                  id="acepta_cdbg"
                  name="acepta_cdbg"
                  type="checkbox"
                  defaultChecked={Boolean(propiedad.acepta_cdbg)}
                  className="h-4 w-4 rounded border-[#d9d9d9] accent-[#11518b]"
                />
                <label htmlFor="acepta_cdbg" className="text-sm text-[#4d4d4d]">
                  Acepta CDBG
                </label>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              <div className="flex items-center gap-3">
                <input
                  id="tiene_placas_solares"
                  name="tiene_placas_solares"
                  type="checkbox"
                  checked={tienePlacas}
                  onChange={(e) => setTienePlacas(e.target.checked)}
                  className="h-4 w-4 rounded border-[#d9d9d9] accent-[#11518b]"
                />
                <label htmlFor="tiene_placas_solares" className="text-sm text-[#4d4d4d]">
                  Tiene placas solares
                </label>
              </div>

              <div className="space-y-2">
                <label htmlFor="cantidad_placas" className="text-sm font-medium text-[#000000]">
                  Cantidad de placas
                </label>
                <input
                  id="cantidad_placas"
                  name="cantidad_placas"
                  type="number"
                  min="0"
                  defaultValue={propiedad.cantidad_placas ?? 0}
                  disabled={!tienePlacas}
                  className="input-premium disabled:bg-[#eeeeee]"
                />
              </div>

              <div className="flex items-center gap-3">
                <input
                  id="placas_en_lease"
                  name="placas_en_lease"
                  type="checkbox"
                  defaultChecked={Boolean(propiedad.placas_en_lease)}
                  disabled={!tienePlacas}
                  className="h-4 w-4 rounded border-[#d9d9d9] accent-[#11518b] disabled:opacity-50"
                />
                <label htmlFor="placas_en_lease" className="text-sm text-[#4d4d4d]">
                  Sistema de placas en lease
                </label>
              </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="pregunta_personalizada" className="text-sm font-medium text-[#000000]">
                  Pregunta personalizada
                </label>
                <textarea
                  id="pregunta_personalizada"
                  name="pregunta_personalizada"
                  rows={3}
                  defaultValue={propiedad.pregunta_personalizada || ""}
                  className="input-premium"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="notas_compradores" className="text-sm font-medium text-[#000000]">
                  Nota adicional para compradores
                </label>
                <textarea
                  id="notas_compradores"
                  name="notas_compradores"
                  rows={3}
                  defaultValue={notasCompradores}
                  className="input-premium"
                />
              </div>
            </div>
          </div>

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
