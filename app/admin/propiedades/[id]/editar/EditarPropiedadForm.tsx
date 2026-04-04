"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
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
                Slug
              </label>
              <input
                id="slug"
                name="slug"
                type="text"
                defaultValue={propiedad.slug}
                className="input-premium"
                required
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="titulo" className="text-sm font-medium text-[#000000]">
                Título
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
              Descripción
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
                Precio
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
                <option value="renta">Renta</option>
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

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
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
                <option value="rentada">Rentada</option>
              </select>
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
              {imagenesPreview.map((url) => (
                <div
                  key={url}
                  className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white"
                >
                  <img
                    src={url}
                    alt="Preview"
                    className="h-40 w-full object-cover"
                  />
                  <div className="p-3">
                    <p className="break-all text-xs text-[#4d4d4d]">{url}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <input
              id="destacado"
              name="destacado"
              type="checkbox"
              defaultChecked={propiedad.destacado}
              className="h-4 w-4"
            />
            <label
              htmlFor="destacado"
              className="text-sm font-medium text-[#000000]"
            >
              Marcar como destacado
            </label>
          </div>

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