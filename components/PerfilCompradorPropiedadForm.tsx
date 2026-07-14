"use client";

import { useRef, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";

export default function PerfilCompradorPropiedadForm({
  propiedadId,
  propiedadSlug,
  requierePrecalificacion,
  preguntaPersonalizada,
  r2Configured,
}: {
  propiedadId: string;
  propiedadSlug: string;
  requierePrecalificacion: boolean;
  preguntaPersonalizada?: string | null;
  r2Configured: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [metodoCompra, setMetodoCompra] = useState("");
  const [trabajaCorredor, setTrabajaCorredor] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    formData.set("propiedad_id", propiedadId);

    try {
      const response = await fetch("/api/consultas-propiedad", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "No se pudo enviar el formulario.");
      }

      const cartaFile = formData.get("carta_precalificacion");
      trackAnalyticsEvent("property_showing_profile_submit_success", {
        property_id: propiedadId,
        property_slug: propiedadSlug,
        metodo_compra: metodoCompra,
        has_prequalification_upload:
          cartaFile instanceof File && cartaFile.size > 0,
      });

      setMessage("Gracias. Tu perfil fue enviado correctamente.");
      formRef.current?.reset();
      setMetodoCompra("");
      setTrabajaCorredor("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setPending(false);
    }
  };

  const debeSubirPrecalificacion =
    requierePrecalificacion && metodoCompra === "Financiamiento";

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {!r2Configured && (
        <div className="rounded-xl border border-[#d4af37] bg-[#fff9e6] p-4 text-sm text-[#4d4d4d]">
          R2 no esta configurado en este ambiente. Puedes probar el formulario sin adjuntar documentos.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nombre completo" name="nombre" required />
        <Field label="Telefono" name="telefono" type="tel" required />
        <Field label="Correo electronico" name="email" type="email" />

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#000000]">
            Método de compra <span className="text-red-500">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Financiamiento", value: "Financiamiento" },
              { label: "Cash", value: "Efectivo" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff]"
              >
                <input
                  type="radio"
                  name="metodo_compra"
                  value={option.value}
                  required
                  checked={metodoCompra === option.value}
                  onChange={(event) => setMetodoCompra(event.target.value)}
                  className="h-4 w-4 border-[#d9d9d9] accent-[#11518b]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {metodoCompra === "Financiamiento" && (
        <UploadField
          label="Carta de precalificación"
          name="carta_precalificacion"
          required={debeSubirPrecalificacion && r2Configured}
          disabled={!r2Configured}
        />
      )}

      {metodoCompra === "Efectivo" && (
        <UploadField
          label="Evidencia de fondos"
          name="evidencia_fondos_archivo"
          disabled={!r2Configured}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Confirmacion de disponibilidad para asistir"
          name="disponibilidad_visita"
          required
          placeholder="Ej: Si, puedo asistir a la hora indicada"
        />
        <Field
          label="Fondos para pronto y gastos de cierre"
          name="fondos_gastos_cierre"
          placeholder="Ej: Tengo fondos disponibles / En proceso"
        />
      </div>

      <div className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#000000]">
            ¿Está trabajando actualmente con otro corredor/realtor?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Sí", value: "Si" },
              { label: "No", value: "No" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff]"
              >
                <input
                  type="radio"
                  name="trabajando_con_corredor"
                  value={option.value}
                  checked={trabajaCorredor === option.value}
                  onChange={(event) => setTrabajaCorredor(event.target.value)}
                  className="h-4 w-4 border-[#d9d9d9] accent-[#11518b]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {trabajaCorredor === "Si" && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nombre del corredor" name="nombre_corredor" />
            <Field
              label="Telefono del corredor"
              name="telefono_corredor"
              type="tel"
            />
          </div>
        )}
      </div>

      {preguntaPersonalizada && (
        <div className="space-y-2">
          <label htmlFor="respuesta_personalizada" className="text-sm font-semibold text-[#000000]">
            {preguntaPersonalizada}
          </label>
          <textarea
            id="respuesta_personalizada"
            name="respuesta_personalizada"
            rows={4}
            className="input-premium resize-none"
          />
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          {message}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <button type="submit" disabled={pending} className="btn-primary w-full justify-center py-3.5 disabled:opacity-60">
        {pending ? "Enviando..." : "Enviar perfil de comprador"}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  disabled,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-semibold text-[#000000]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        disabled={disabled}
        className="input-premium disabled:bg-[#eeeeee]"
      />
    </div>
  );
}

function UploadField({
  label,
  name,
  required,
  disabled,
}: {
  label: string;
  name: string;
  required?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-semibold text-[#000000]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/jpg"
        required={required}
        disabled={disabled}
        className="block w-full rounded-xl border border-[#d9d9d9] bg-white px-4 py-3 text-sm text-[#333333] file:mr-4 file:rounded-full file:border-0 file:bg-[#11518b] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:bg-[#eeeeee]"
      />
    </div>
  );
}
