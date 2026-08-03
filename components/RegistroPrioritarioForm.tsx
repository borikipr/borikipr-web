"use client";

import { useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { usePublicFormError, usePublicFormText } from "@/components/usePublicFormText";

type RegistroPrioritarioFormProps = {
  propertyId: string;
  propertySlug: string;
  propertyTitle: string;
};

const purchaseTypes = ["Cash", "Financiamiento", "Otros (especifique)"];
const prequalifiedStatuses = ["Sí", "No", "En proceso"];
const propertySizeOptions = [
  "2 habitaciones",
  "3 habitaciones",
  "4 o más habitaciones",
];
const yesNoOptions = ["Sí", "No"];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegistroPrioritarioForm({
  propertyId,
  propertySlug,
  propertyTitle,
}: RegistroPrioritarioFormProps) {
  const t = usePublicFormText();
  const formError = usePublicFormError();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [purchaseType, setPurchaseType] = useState("");
  const [purchaseOther, setPurchaseOther] = useState("");
  const [prequalifiedStatus, setPrequalifiedStatus] = useState("");
  const showPrequalifiedQuestion = purchaseType === "Financiamiento";
  const showPurchaseOtherQuestion = purchaseType === "Otros (especifique)";

  const handlePurchaseTypeChange = (value: string) => {
    setPurchaseType(value);
    if (value !== "Otros (especifique)") {
      setPurchaseOther("");
    }
    if (value !== "Financiamiento") {
      setPrequalifiedStatus("");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setSuccess(null);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const email = String(formData.get("email") || "").trim();

    if (!EMAIL_PATTERN.test(email)) {
      setError(t("Ingresa un email válido."));
      setLoading(false);
      return;
    }

    const payload = {
      propertyId,
      propertySlug,
      propertyTitle,
      name: String(formData.get("name") || "").trim(),
      phone: String(formData.get("phone") || "").trim(),
      email,
      purchaseType,
      purchaseOther: showPurchaseOtherQuestion ? purchaseOther.trim() : "",
      prequalifiedStatus: showPrequalifiedQuestion ? prequalifiedStatus : "",
      propertySize: String(formData.get("propertySize") || "").trim(),
      searchRange: String(formData.get("searchRange") || "").trim(),
      wantsVisit: String(formData.get("wantsVisit") || "").trim(),
      additionalInfo: String(formData.get("additionalInfo") || "").trim(),
    };

    try {
      const response = await fetch("/api/registro-prioritario", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(formError(result.error, "No se pudo enviar el registro."));
      }

      if (result.duplicate) {
        trackAnalyticsEvent("priority_registration_duplicate", {
          property_slug: propertySlug,
        });
        setSuccess({
          title: t("Ya tenemos tu registro"),
          message: t("Este Email ya está registrado para esta propiedad. Te contactaremos tan pronto tengamos los detalles disponibles."),
        });
      } else {
        trackAnalyticsEvent("priority_registration_submit_success", {
          property_slug: propertySlug,
          purchase_type: payload.purchaseType,
          property_size: payload.propertySize,
          wants_visit: payload.wantsVisit,
        });
        setSuccess({
          title: t("¡Gracias por tu registro!"),
          message: t("Te contactaré tan pronto tenga todos los detalles de esta propiedad disponibles."),
        });
        setPurchaseType("");
        setPurchaseOther("");
        setPrequalifiedStatus("");
        form.reset();
      }
    } catch (err) {
      trackAnalyticsEvent("priority_registration_submit_error", {
        property_slug: propertySlug,
        error_type: "submit_error",
      });
      setError(err instanceof Error ? err.message : t("Error desconocido."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8"
      data-clarity-mask="true"
    >
      <div className="grid gap-5 md:grid-cols-2">
        <Field label={t("Nombre completo")} htmlFor="name" required>
          <input id="name" name="name" type="text" required className="input-premium" />
        </Field>

        <Field label={t("Teléfono")} htmlFor="phone" required>
          <input id="phone" name="phone" type="tel" required className="input-premium" />
        </Field>

        <Field label="Email" htmlFor="email" required>
          <input id="email" name="email" type="email" required className="input-premium" />
        </Field>

      </div>

      <ChoiceGroup
        legend={t("¿Cómo planeas realizar la compra?")}
        name="purchaseType"
        options={purchaseTypes.map((value) => ({ value, label: t(value) }))}
        value={purchaseType}
        onChange={handlePurchaseTypeChange}
        required
        columns="sm:grid-cols-2"
      />

      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          showPurchaseOtherQuestion
            ? "max-h-40 opacity-100"
            : "max-h-0 opacity-0"
        }`}
        aria-hidden={!showPurchaseOtherQuestion}
      >
        <Field label={t("Especifique")} htmlFor="purchaseOther" required={showPurchaseOtherQuestion}>
          <input
            id="purchaseOther"
            name="purchaseOther"
            type="text"
            required={showPurchaseOtherQuestion}
            disabled={!showPurchaseOtherQuestion}
            value={purchaseOther}
            onChange={(event) => setPurchaseOther(event.target.value)}
            className="input-premium"
            placeholder={t("Escriba cómo planea realizar la compra.")}
          />
        </Field>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${
          showPrequalifiedQuestion
            ? "max-h-40 opacity-100"
            : "max-h-0 opacity-0"
        }`}
        aria-hidden={!showPrequalifiedQuestion}
      >
        <ChoiceGroup
          legend={t("¿Te encuentras precalificado(a)?")}
          name="prequalifiedStatus"
          options={prequalifiedStatuses.map((value) => ({ value, label: t(value) }))}
          value={prequalifiedStatus}
          onChange={setPrequalifiedStatus}
          required={showPrequalifiedQuestion}
          disabled={!showPrequalifiedQuestion}
          columns="sm:grid-cols-3"
        />
      </div>

      <ChoiceGroup
        legend={t("¿Qué tamaño de propiedad estás buscando?")}
        name="propertySize"
        options={propertySizeOptions.map((value) => ({ value, label: t(value) }))}
        required
        columns="sm:grid-cols-2"
      />

      <Field label={t("¿En qué rango de precio estás buscando?")} htmlFor="searchRange" required>
        <input
          id="searchRange"
          name="searchRange"
          type="text"
          required
          className="input-premium"
          placeholder={t("Ejemplo: $250,000 - $350,000")}
        />
      </Field>

      <ChoiceGroup
        legend={t("¿Te interesa coordinar una visita tan pronto esté disponible?")}
        name="wantsVisit"
        options={yesNoOptions.map((value) => ({ value, label: t(value) }))}
        required
        columns="sm:grid-cols-2"
      />

      <Field
        label={t("¿Alguna información adicional que quieras compartir?")}
        htmlFor="additionalInfo"
      >
        <textarea
          id="additionalInfo"
          name="additionalInfo"
          rows={4}
          className="input-premium"
          placeholder={t("Tu respuesta")}
        />
      </Field>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-semibold">{success.title}</p>
          <p className="mt-1 font-medium">{success.message}</p>
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
        {loading ? t("Enviando...") : t("Enviar registro prioritario")}
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
  required,
  disabled,
  columns = "grid-cols-1",
  value,
  onChange,
}: {
  legend: string;
  name: string;
  options: Array<string | { label: string; value: string }>;
  required?: boolean;
  disabled?: boolean;
  columns?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-semibold text-[#000000]">
        {legend} {required && <span className="text-red-500">*</span>}
      </legend>
      <div className={`grid gap-3 ${columns}`}>
        {options.map((option) => {
          const item = typeof option === "string" ? { label: option, value: option } : option;
          return (
          <label
            key={item.value}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm font-semibold text-[#111111] transition hover:border-[#d4af37]"
          >
            <input
              type="radio"
              name={name}
              value={item.value}
              required={required}
              disabled={disabled}
              checked={value !== undefined ? value === item.value : undefined}
              onChange={() => onChange?.(item.value)}
              className="h-4 w-4 accent-[#11518b]"
            />
            <span>{item.label}</span>
          </label>
          );
        })}
      </div>
    </fieldset>
  );
}

