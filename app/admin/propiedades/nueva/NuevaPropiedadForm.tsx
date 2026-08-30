"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AdminPageHeader, AdminPageShell } from "@/components/admin/AdminPageShell";
import { municipiosPR } from "@/data/municipios";
import { createPropiedadAction, type CreatePropiedadState } from "../actions";
import ImagenesUploader from "../ImagenesUploader";
import PropertyMediaManager from "../PropertyMediaManager";
import { formatPropertyLocation, getSectoresForMunicipio } from "@/lib/puerto-rico-sectores";
import type { ListingResponsibleProfessional } from "@/lib/admin/listing-responsibility";

const initialState: CreatePropiedadState = {
  error: "",
};

function previewSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildPreviewSlugBase(titulo: string, sectorComunidad: string, municipio: string) {
  const normalizedTitle = previewSlug(titulo);
  const normalizedSector = previewSlug(sectorComunidad);

  if (normalizedSector && !normalizedTitle.includes(normalizedSector)) {
    return `${titulo} ${sectorComunidad} ${municipio}`;
  }

  return `${titulo} ${municipio}`;
}

function buildDescriptionTemplate({
  municipio,
  sectorComunidad,
  tipoNegocio,
  tipoPropiedad,
  estado,
}: {
  municipio: string;
  sectorComunidad: string;
  tipoNegocio: string;
  tipoPropiedad: string;
  estado: string;
}) {
  const location = municipio ? formatPropertyLocation(municipio, sectorComunidad) : "Puerto Rico";
  const propertyType = tipoPropiedad ? `${tipoPropiedad.toLowerCase()} ` : "";

  if (estado === "coming_soon") {
    return `Propiedad próximamente disponible en ${location}. Actualmente se encuentra en proceso de preparación para salir al mercado. Para más información o para registrar tu interés, comunícate con Erickson Real Estate.`;
  }

  if (tipoNegocio === "renta") {
    return `${propertyType}disponible para alquiler en ${location}. Ideal para quienes buscan una opción cómoda y bien ubicada. Para más información o coordinar una visita, comunícate con Erickson Real Estate.`;
  }

  return `Excelente oportunidad de compra en ${location}. Esta ${propertyType || "propiedad "}ofrece una alternativa ideal para quienes buscan comodidad, ubicación y potencial. Para más información o coordinar una visita, comunícate con Erickson Real Estate.`;
}

export default function NuevaPropiedadForm({ eligibleProfessionals }: { eligibleProfessionals: ListingResponsibleProfessional[] }) {
  const [state, formAction, pending] = useActionState(
    createPropiedadAction,
    initialState
  );
  const [imagenesValue, setImagenesValue] = useState("");
  const [destacado, setDestacado] = useState(false);
  const [origenListado, setOrigenListado] = useState<"propio" | "co_broke" | "externo">("propio");
  const [showingActivo, setShowingActivo] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [municipio, setMunicipio] = useState("");
  const [sectorComunidad, setSectorComunidad] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipoNegocio, setTipoNegocio] = useState("");
  const [tipoPropiedad, setTipoPropiedad] = useState("");
  const [estado, setEstado] = useState("disponible");

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

  const sectoresDisponibles = getSectoresForMunicipio(municipio);
  const slugPreview =
    previewSlug(buildPreviewSlugBase(titulo, sectorComunidad, municipio)) ||
    "slug-generado-automaticamente";

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
        sectorComunidad,
        tipoNegocio,
        tipoPropiedad,
        estado,
      })
    );
  };

  return (
    <AdminPageShell>
      <div className="property-editor-page">
        <AdminPageHeader
          breadcrumbs={[{ href: "/admin", label: "Admin" }, { href: "/admin/propiedades", label: "Propiedades" }, { label: "Nueva" }]}
          eyebrow="Inventario · Nueva propiedad"
          title="Crear propiedad"
          description="Prepara la información comercial, la publicación y la galería del nuevo listado."
          actions={<Link href="/admin/propiedades" className="btn-secondary"><ArrowLeft aria-hidden="true" size={16} /> Volver</Link>}
        />

        <div className="space-y-6">
          <ImagenesUploader onUploaded={handleUploaded} />

          <div className="property-editor-surface">
            <form action={formAction} className="property-editor-form">
              <div className="property-form-section-heading"><span>01</span><div><h2>Información principal</h2><p>Identidad, ubicación y datos comerciales del listado.</p></div></div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[#000000]">
                    URL Preview
                  </p>
                  <div className="flex min-h-[46px] items-center rounded-xl border border-[#d9d9d9] bg-[#f8f8f8] px-4 py-3 text-sm text-[#4d4d4d]">
                    borikipr.com/listados/{slugPreview}
                  </div>
                  <p className="text-xs text-[#4d4d4d]">
                    Identificador único para la URL (solo letras, números y guiones).
                  </p>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="titulo"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Título <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="titulo"
                    name="titulo"
                    type="text"
                    placeholder="Residencia moderna con piscina"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                    className="input-premium"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <div className="space-y-2">
                  <label
                    htmlFor="municipio"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Municipio
                  </label>
                  <select
                    id="municipio"
                    name="municipio"
                    value={municipio}
                    onChange={(e) => {
                      const nextMunicipio = e.target.value;
                      setMunicipio(nextMunicipio);
                      if (!getSectoresForMunicipio(nextMunicipio).includes(sectorComunidad)) {
                        setSectorComunidad("");
                      }
                    }}
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

                {sectoresDisponibles.length > 0 && (
                  <div className="space-y-2">
                    <label
                      htmlFor="sector_comunidad"
                      className="text-sm font-medium text-[#000000]"
                    >
                      Sector / Comunidad
                    </label>
                    <select
                      id="sector_comunidad"
                      name="sector_comunidad"
                      value={sectorComunidad}
                      onChange={(e) => setSectorComunidad(e.target.value)}
                      className="input-premium"
                    >
                      <option value="">Opcional</option>
                      {sectoresDisponibles.map((sector) => (
                        <option key={sector} value={sector}>
                          {sector}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2">
                  <label
                    htmlFor="precio"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Precio
                  </label>
                  <input
                    id="precio"
                    name="precio"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="350000"
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
                    onChange={(e) => setTipoNegocio(e.target.value)}
                    className="input-premium"
                    required
                  >
                    <option value="">Selecciona</option>
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
                    onChange={(e) => setTipoPropiedad(e.target.value)}
                    className="input-premium"
                    required
                  >
                    <option value="">Selecciona</option>
                    <option value="Casa">Casa</option>
                    <option value="Apartamento">Apartamento</option>
                    <option value="Condominio">Condominio</option>
                    <option value="Terreno">Terreno</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </div>
              </div>

              <div className="property-form-section-heading"><span>02</span><div><h2>Características</h2><p>Detalles físicos, estado y prioridad de publicación.</p></div></div>
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-6">
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
                    defaultValue="0"
                    className="input-premium"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="banos"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Baños
                  </label>
                  <input
                    id="banos"
                    name="banos"
                    type="number"
                    min="0"
                    defaultValue="0"
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
                    defaultValue="0"
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
                    defaultValue="0"
                    className="input-premium"
                  />
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="estado"
                    className="text-sm font-medium text-[#000000]"
                  >
                    Estado
                  </label>
                  <select
                    id="estado"
                    name="estado"
                    value={estado}
                    onChange={(e) => setEstado(e.target.value)}
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

              <div className="space-y-2 rounded-2xl border border-[#d9d9d9] p-5">
                <div className="flex items-start gap-3">
                  <input
                    id="placas_en_lease"
                    name="placas_en_lease"
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-[#d9d9d9] accent-[#11518b]"
                  />
                  <label htmlFor="placas_en_lease" className="text-sm font-medium text-[#000000]">
                    La propiedad tiene placas solares con contrato o leasing vigente
                  </label>
                </div>
                <p className="pl-7 text-sm text-[#4d4d4d]">
                  Activa esta opción para preguntar al comprador si estaría dispuesto(a) a asumir el contrato o leasing de las placas solares.
                </p>
              </div>

              <div className="property-form-section-heading"><span>03</span><div><h2>Publicación y operación</h2><p>Origen del listado, permisos y herramientas de captación.</p></div></div>
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
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="listing_responsible_user_id" className="text-sm font-medium text-[#000000]">
                  Responsable del listado {origenListado === "propio" && <span className="text-red-500">*</span>}
                </label>
                <select
                  id="listing_responsible_user_id"
                  name="listing_responsible_user_id"
                  className="input-premium"
                  required={origenListado === "propio"}
                  aria-describedby={state.listingResponsibleError ? "listing-responsible-error" : undefined}
                  aria-invalid={Boolean(state.listingResponsibleError)}
                >
                  <option value="">{origenListado === "propio" ? "Selecciona un responsable" : "Sin responsable asignado"}</option>
                  {eligibleProfessionals.map((professional) => (
                    <option key={professional.id} value={professional.id}>
                      {professional.displayName} — {professional.role === "real_estate_broker" ? "Corredora" : "Vendedor(a)"} · Lic. {professional.licenseNumber}
                    </option>
                  ))}
                </select>
                {origenListado === "propio" && eligibleProfessionals.length === 0 && <p className="text-sm text-amber-800" role="alert">No hay corredores o vendedores licenciados disponibles para asignar.</p>}
                {state.listingResponsibleError && <p id="listing-responsible-error" className="text-sm text-red-600" role="alert">{state.listingResponsibleError}</p>}
              </div>

              {origenListado === "co_broke" && (
                <div className="space-y-6 rounded-2xl border border-[#d4af37]/30 bg-[#fff9e6]/50 p-6">
                  <div className="flex items-start gap-3">
                    <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#d4af37] text-sm font-bold text-white">
                      ℹ
                    </div>
                    <p className="text-sm text-[#4d4d4d]">
                      Completa la información del corredor colaborador para esta propiedad.
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
                      placeholder="Información adicional, acuerdos especiales, etc. (no se mostrará públicamente)"
                      className="input-premium"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-6 rounded-2xl border border-[#11518b]/20 bg-[#f7fbff] p-6">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#11518b]">
                    Formulario de Open House
                  </p>
                  <p className="mt-2 text-sm text-[#4d4d4d]">
                    Actívalo solo cuando haya una fecha y hora confirmadas para recibir registros de asistencia.
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
                    Activar formulario de Open House
                  </label>
                </div>

                {showingActivo && (
                  <div className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-3">
                      <div className="space-y-2">
                        <label htmlFor="fecha_showing_fecha" className="text-sm font-medium text-[#000000]">
                          Fecha del Open House
                        </label>
                        <input
                          id="fecha_showing_fecha"
                          name="fecha_showing_fecha"
                          type="date"
                          className="input-premium"
                        />
                      </div>

                      <div className="space-y-2">
                        <label htmlFor="fecha_showing_hora" className="text-sm font-medium text-[#000000]">
                          Hora del Open House
                        </label>
                        <input
                          id="fecha_showing_hora"
                          name="fecha_showing_hora"
                          type="time"
                          className="input-premium"
                        />
                      </div>

                      <div className="flex items-center gap-3 pt-7">
                        <input
                          id="requiere_precalificacion"
                          name="requiere_precalificacion"
                          type="checkbox"
                          className="h-4 w-4 rounded border-[#d9d9d9] accent-[#11518b]"
                        />
                        <label htmlFor="requiere_precalificacion" className="text-sm text-[#4d4d4d]">
                          Requiere carta de precalificación
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2 rounded-2xl border border-[#11518b]/15 bg-white p-5">
                      <div className="flex items-start gap-3">
                        <input
                          id="open_house_solar_question_enabled"
                          name="open_house_solar_question_enabled"
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-[#d9d9d9] accent-[#11518b]"
                        />
                        <label
                          htmlFor="open_house_solar_question_enabled"
                          className="text-sm font-medium text-[#000000]"
                        >
                          Preguntar sobre el contrato o leasing de las placas
                          solares en el Open House
                        </label>
                      </div>
                      <p className="pl-7 text-sm text-[#4d4d4d]">
                        Activa esta opción para preguntar a los asistentes si
                        estarían dispuestos a asumir el contrato o leasing vigente
                        de las placas solares.
                      </p>
                    </div>

                    <div>
                      <div className="space-y-2">
                        <label htmlFor="notas_compradores" className="text-sm font-medium text-[#000000]">
                          Nota adicional para compradores
                        </label>
                        <textarea
                          id="notas_compradores"
                          name="notas_compradores"
                          rows={3}
                          className="input-premium"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="property-form-section-heading"><span>04</span><div><h2>Descripción</h2><p>Contenido público que presenta la propiedad.</p></div></div>
              <div className="space-y-2">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label
                    htmlFor="descripcion"
                    className="text-sm font-medium text-[#000000]"
                  >
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
                  placeholder="Describe la propiedad con claridad y enfoque comercial..."
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  className="input-premium"
                  required
                />
              </div>

              <div className="property-form-section-heading"><span>05</span><div><h2>Multimedia</h2><p>Revisa el orden y selecciona la portada pública.</p></div></div>
              <input type="hidden" id="imagenes" name="imagenes" value={imagenesValue} />
              <PropertyMediaManager items={imagenesPreview} onChange={(urls) => setImagenesValue(urls.join(", "))} />

              {state.error && (
                <p className="text-sm text-red-600">{state.error}</p>
              )}

              <div className="property-save-bar">
                <button
                  type="submit"
                  disabled={pending}
                  className="btn-primary disabled:opacity-60"
                >
                  {pending ? "Guardando..." : "Crear propiedad"}
                </button>

                <Link href="/admin/propiedades" className="btn-secondary">
                  Cancelar
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </AdminPageShell>
  );
}
