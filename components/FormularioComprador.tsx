"use client";

import { useRef, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { usePublicFormError, usePublicFormText } from "@/components/usePublicFormText";

const tiposPropiedad = [
  "Casa",
  "Apartamento",
  "Condominio",
  "Terreno",
  "Propiedad comercial",
];

const habitaciones = ["1", "2", "3", "4+"];
const banos = ["1", "2", "3+"];
const interesesPrincipales = ["Comprar", "Alquilar"];
const cualificacionCompra = [
  "Cuento con una carta de precalificación vigente.",
  "Estoy en proceso de obtener mi carta de precalificación.",
  "Aún no he iniciado el proceso con una institución financiera.",
  "La compra sería en efectivo.",
  "Utilizaré otro método o programa de ayuda.",
];

export default function FormularioComprador() {
  const t = usePublicFormText();
  const formError = usePublicFormError();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [interesPrincipal, setInteresPrincipal] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const idempotencyKeyRef = useRef(crypto.randomUUID());

  const handleInterestChange = (value: string) => {
    if (value === "Alquilar") {
      const priorQualification = formRef.current?.querySelector<HTMLInputElement>(
        'input[name="cualificacionCompra"]:checked'
      );
      if (priorQualification) priorQualification.checked = false;
    }
    setInteresPrincipal(value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const form = formRef.current!;
    const formData = new FormData(form);
    const tiposSeleccionados = Array.from(
      form.querySelectorAll('input[name="tipoPropiedad"]:checked')
    ).map((el) => (el as HTMLInputElement).value);

    const data = {
      idempotencyKey: idempotencyKeyRef.current,
      nombre: formData.get("nombre"),
      telefono: formData.get("telefono"),
      email: formData.get("email"),
      interesPrincipal: formData.get("interesPrincipal"),
      cualificacionCompra:
        interesPrincipal === "Comprar"
          ? formData.get("cualificacionCompra")
          : null,
      municipios: formData.get("municipios"),
      tipoPropiedad: tiposSeleccionados,
      presupuesto: formData.get("presupuesto"),
      habitaciones: formData.get("habitaciones"),
      banos: formData.get("banos"),
      comentarios: formData.get("comentarios"),
    };

    try {
      const response = await fetch("/api/formulario/comprador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(formError(result.error, "Error al enviar el formulario"));
      }

      trackAnalyticsEvent("buyer_tenant_form_submit_success", {
        interes_principal: String(data.interesPrincipal || ""),
        has_qualification: Boolean(data.cualificacionCompra),
      });

      setSuccess(true);
      setInteresPrincipal("");
      formRef.current?.reset();
      idempotencyKeyRef.current = crypto.randomUUID();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Error desconocido"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="space-y-7"
      data-clarity-mask="true"
    >
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
          {t("Información de contacto")}
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("Nombre completo")} htmlFor="nombre" required>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            placeholder={t("Tu nombre y apellido")}
            className="input-premium"
          />
        </Field>

        <Field label={t("Teléfono")} htmlFor="telefono" required>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            required
            placeholder="(787) 123-4567"
            className="input-premium"
          />
        </Field>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Email" htmlFor="email">
          <input
            id="email"
            name="email"
            type="email"
            placeholder="tu@email.com"
            className="input-premium"
          />
        </Field>

        <Field label={t("Municipio o zona de interés")} htmlFor="municipios" required>
          <input
            id="municipios"
            name="municipios"
            type="text"
            required
            placeholder={t("Ej: Guaynabo, Dorado, San Juan")}
            className="input-premium"
          />
        </Field>
      </div>

      <ChoiceGroup
        legend={t("¿Cuál es tu interés principal?")}
        name="interesPrincipal"
        options={interesesPrincipales.map((value) => ({ value, label: t(value) }))}
        type="radio"
        required
        columns="sm:grid-cols-2"
        value={interesPrincipal}
        onChange={handleInterestChange}
      />

      {interesPrincipal === "Comprar" && (
        <ChoiceGroup
          legend={t("¿Cómo se encuentra cualificado(a) actualmente para la compra?")}
          name="cualificacionCompra"
          options={cualificacionCompra.map((value) => ({ value, label: t(value) }))}
          type="radio"
          required
        />
      )}

      <ChoiceGroup
        legend={t("Tipo de propiedad de interés")}
        name="tipoPropiedad"
        options={tiposPropiedad.map((value) => ({ value, label: t(value) }))}
        type="checkbox"
        columns="sm:grid-cols-2"
      />

      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("Presupuesto aproximado de compra o alquiler")} htmlFor="presupuesto" required>
          <input
            id="presupuesto"
            name="presupuesto"
            type="text"
            required
            placeholder="$250,000 - $450,000"
            className="input-premium"
          />
        </Field>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <ChoiceGroup
          legend={t("Habitaciones deseadas")}
          name="habitaciones"
          options={habitaciones}
          type="radio"
        />
        <ChoiceGroup
          legend={t("Baños deseados")}
          name="banos"
          options={banos}
          type="radio"
        />
      </div>

      <Field label={t("Comentarios adicionales")} htmlFor="comentarios">
        <textarea
          id="comentarios"
          name="comentarios"
          rows={5}
          placeholder={t("Comparte cualquier detalle importante sobre ubicación, estilo de vida, financiamiento o preferencias.")}
          className="input-premium resize-none"
        />
      </Field>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          {t("Gracias. Tu solicitud fue enviada correctamente y nos comunicaremos pronto.")}
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
        {loading ? t("Enviando...") : t("Enviar solicitud")}
      </button>
    </form>
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
  type,
  required,
  columns = "grid-cols-1",
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: Array<string | { label: string; value: string }>;
  type: "radio" | "checkbox";
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
          const item = typeof option === "string" ? { label: option, value: option } : option;
          return (
          <label
            key={item.value}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff]"
          >
            <input
              type={type}
              name={name}
              value={item.value}
              required={required}
              checked={type === "radio" && value !== undefined ? value === item.value : undefined}
              onChange={onChange ? () => onChange(item.value) : undefined}
              className="h-4 w-4 border-[#d9d9d9] text-[#11518b] accent-[#11518b]"
            />
            <span>{item.label}</span>
          </label>
          );
        })}
      </div>
    </fieldset>
  );
}
