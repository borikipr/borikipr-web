"use client";

import { useRef, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import {
  BUYER_PROFILE_FILE_TOO_LARGE_MESSAGE,
  BUYER_PROFILE_UPLOAD_HELPER,
  MAX_BUYER_PROFILE_DOCUMENT_BYTES,
} from "@/lib/leads/property-buyer-profile-upload";

const metodosCompra = [
  { label: "Financiamiento", value: "Financiamiento" },
  { label: "Cash", value: "Cash" },
  { label: "Otro", value: "Otro" },
];
const fondosCierre = ["Sí", "Parcialmente", "Aún no"];
const solarContractOptions = [
  { label: "Sí", value: "yes" },
  { label: "No", value: "no" },
];

type FormularioPerfilCompradorProps = {
  propertyId: string;
  propertySlug: string;
  propertyTitle: string;
  propertyStatus: string;
  tipoNegocio: "venta" | "renta";
  municipio: string;
  sectorComunidad?: string | null;
  requiresSolarContractAcceptance: boolean;
};

export default function FormularioPerfilComprador({
  propertyId,
  propertySlug,
  propertyTitle,
  propertyStatus,
  tipoNegocio,
  municipio,
  sectorComunidad,
  requiresSolarContractAcceptance,
}: FormularioPerfilCompradorProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [metodoCompra, setMetodoCompra] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    formData.set("propertyId", propertyId);
    formData.set("propertySlug", propertySlug);
    formData.set("propertyTitle", propertyTitle);
    formData.set("idempotencyKey", idempotencyKeyRef.current);
    const cartaFile = formData.get("cartaPreaprobacion");

    if (
      cartaFile instanceof File &&
      cartaFile.size > MAX_BUYER_PROFILE_DOCUMENT_BYTES
    ) {
      setError(BUYER_PROFILE_FILE_TOO_LARGE_MESSAGE);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/formulario/perfil-comprador", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Error al enviar el formulario");
      }

      trackAnalyticsEvent("buyer_profile_form_submit_success", {
        metodo_compra: metodoCompra,
        has_upload: cartaFile instanceof File && cartaFile.size > 0,
        property_slug: propertySlug,
        status: propertyStatus,
        tipo_negocio: tipoNegocio,
        municipio,
        sector_comunidad: sectorComunidad,
      });

      setSuccess(true);
      setMetodoCompra("");
      formRef.current?.reset();
      idempotencyKeyRef.current = crypto.randomUUID();
      setTimeout(() => setSuccess(false), 6000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
      <SectionHeader
        title="Información de contacto"
        description="Comparte cómo podemos comunicarnos contigo para dar seguimiento a tu proceso de compra."
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nombre completo" htmlFor="nombre" required>
          <input id="nombre" name="nombre" type="text" required className="input-premium" />
        </Field>
        <Field label="Teléfono" htmlFor="telefono" required>
          <input id="telefono" name="telefono" type="tel" required className="input-premium" />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" name="email" type="email" className="input-premium" />
        </Field>
      </div>

      <SectionHeader title="Método de compra" />

      <ChoiceGroup
        legend="Método de compra"
        name="metodoCompra"
        options={metodosCompra}
        value={metodoCompra}
        onChange={setMetodoCompra}
        required
        columns="sm:grid-cols-3"
      />

      {metodoCompra === "Financiamiento" && (
        <div className="space-y-6 rounded-2xl border border-[#e8e8e8] bg-[#f8f8f8] p-5">
          <Field label="Institución financiera (opcional)" htmlFor="institucionFinanciera">
            <input id="institucionFinanciera" name="institucionFinanciera" type="text" className="input-premium" />
          </Field>
          <UploadField
            label="Carta de precalificación"
            helper={BUYER_PROFILE_UPLOAD_HELPER}
            name="cartaPreaprobacion"
          />
        </div>
      )}

      {metodoCompra === "Otros" && (
        <div className="rounded-2xl border border-[#e8e8e8] bg-[#f8f8f8] p-5">
          <Field
            label="Especifique el método de compra o ayuda que piensa utilizar"
            htmlFor="metodoCompraOtro"
          >
            <input
              id="metodoCompraOtro"
              name="metodoCompraOtro"
              type="text"
              placeholder="Ejemplo: R3, CDBG-DR, fondos de asistencia, otro programa o ayuda"
              className="input-premium"
            />
          </Field>
        </div>
      )}

      {metodoCompra === "Cash" && (
        <div className="rounded-2xl border border-[#e8e8e8] bg-[#f8f8f8] p-5">
          <UploadField
            label="Evidencia de fondos"
            helper={BUYER_PROFILE_UPLOAD_HELPER}
            name="cartaPreaprobacion"
          />
        </div>
      )}

      {requiresSolarContractAcceptance && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#000000]">
            Esta propiedad cuenta con un sistema de placas solares por lease que le añade valor y ahorro energético al hogar. ¿Estarías dispuesto(a) a asumir ese lease como parte de la compra? <span className="text-red-500">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {solarContractOptions.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff]"
              >
                <input
                  type="radio"
                  name="solarContractAcceptance"
                  value={option.value}
                  required
                  className="h-4 w-4 border-[#d9d9d9] accent-[#11518b]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <SectionHeader title="Preparación financiera" />
      <ChoiceGroup
        legend="¿Cuenta con fondos para el pronto (down payment) y gastos de cierre?"
        name="fondosCierre"
        options={fondosCierre}
        columns="sm:grid-cols-3"
      />

      <SectionHeader title="Información adicional" />
      <Field label="Comentarios adicionales" htmlFor="comentarios">
        <textarea
          id="comentarios"
          name="comentarios"
          rows={5}
          className="input-premium resize-none"
          placeholder="Comparte cualquier detalle que Ivonne deba conocer antes de la próxima conversación."
        />
      </Field>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          Gracias. Tu perfil del cliente comprador fue enviado correctamente.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Enviando..." : "Enviar perfil del cliente comprador"}
      </button>
    </form>
  );
}

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div>
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
        {title}
      </p>
      {description && (
        <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">{description}</p>
      )}
    </div>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-[#000000]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ChoiceGroup({
  legend,
  name,
  options,
  type = "radio",
  required,
  columns = "grid-cols-1",
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: Array<string | { label: string; value: string }>;
  type?: "radio" | "checkbox";
  required?: boolean;
  columns?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-[#000000]">
        {legend} {required && <span className="text-red-500">*</span>}
      </legend>
      <div className={`grid gap-2 ${columns}`}>
        {options.map((option) => {
          const optionValue = typeof option === "string" ? option : option.value;
          const optionLabel = typeof option === "string" ? option : option.label;

          return (
            <label
              key={optionValue}
              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff]"
            >
              <input
                type={type}
                name={name}
                value={optionValue}
                required={required}
                checked={value === undefined ? undefined : value === optionValue}
                onChange={() => onChange?.(optionValue)}
                className="h-4 w-4 border-[#d9d9d9] accent-[#11518b]"
              />
              <span>{optionLabel}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function UploadField({
  label,
  helper,
  name,
}: {
  label: string;
  helper?: string;
  name: string;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-semibold text-[#000000]">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/jpg"
        className="block w-full rounded-xl border border-[#d9d9d9] bg-white px-4 py-3 text-sm text-[#333333] file:mr-4 file:rounded-full file:border-0 file:bg-[#11518b] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white"
      />
      {helper && <p className="text-xs text-[#4d4d4d]">{helper}</p>}
    </div>
  );
}
