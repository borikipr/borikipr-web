"use client";

import { useState } from "react";

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
      setError("Ingresa un email válido.");
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
        throw new Error(result.error || "No se pudo enviar el registro.");
      }

      if (result.duplicate) {
        setSuccess({
          title: "Ya tenemos tu registro",
          message:
            "Este Email ya está registrado para esta propiedad. Te contactaremos tan pronto tengamos los detalles disponibles.",
        });
      } else {
        setSuccess({
          title: "¡Gracias por tu registro!",
          message:
            "Te contactaré tan pronto tenga todos los detalles de esta propiedad disponibles.",
        });
        setPurchaseType("");
        setPurchaseOther("");
        setPrequalifiedStatus("");
        form.reset();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nombre completo" htmlFor="name" required>
          <input id="name" name="name" type="text" required className="input-premium" />
        </Field>

        <Field label="Teléfono" htmlFor="phone" required>
          <input id="phone" name="phone" type="tel" required className="input-premium" />
        </Field>

        <Field label="Email" htmlFor="email" required>
          <input id="email" name="email" type="email" required className="input-premium" />
        </Field>

      </div>

      <ChoiceGroup
        legend="¿Cómo planeas realizar la compra?"
        name="purchaseType"
        options={purchaseTypes}
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
        <Field label="Especifique" htmlFor="purchaseOther" required={showPurchaseOtherQuestion}>
          <input
            id="purchaseOther"
            name="purchaseOther"
            type="text"
            required={showPurchaseOtherQuestion}
            disabled={!showPurchaseOtherQuestion}
            value={purchaseOther}
            onChange={(event) => setPurchaseOther(event.target.value)}
            className="input-premium"
            placeholder="Escriba cómo planea realizar la compra."
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
          legend="¿Te encuentras pre-calificado(a)?"
          name="prequalifiedStatus"
          options={prequalifiedStatuses}
          value={prequalifiedStatus}
          onChange={setPrequalifiedStatus}
          required={showPrequalifiedQuestion}
          disabled={!showPrequalifiedQuestion}
          columns="sm:grid-cols-3"
        />
      </div>

      <ChoiceGroup
        legend="¿Qué tamaño de propiedad estás buscando?"
        name="propertySize"
        options={propertySizeOptions}
        required
        columns="sm:grid-cols-2"
      />

      <Field label="¿En qué rango de precio estás buscando?" htmlFor="searchRange" required>
        <input
          id="searchRange"
          name="searchRange"
          type="text"
          required
          className="input-premium"
          placeholder="Ejemplo: $250,000 - $350,000"
        />
      </Field>

      <ChoiceGroup
        legend="¿Te interesa coordinar una visita tan pronto esté disponible?"
        name="wantsVisit"
        options={yesNoOptions}
        required
        columns="sm:grid-cols-2"
      />

      <Field
        label="¿Alguna información adicional que quieras compartir?"
        htmlFor="additionalInfo"
      >
        <textarea
          id="additionalInfo"
          name="additionalInfo"
          rows={4}
          className="input-premium"
          placeholder="Tu respuesta"
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
        {loading ? "Enviando..." : "Enviar registro prioritario"}
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
  options: string[];
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
        {options.map((option) => (
          <label
            key={option}
            className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#e8e8e8] bg-white px-4 py-3 text-sm font-semibold text-[#111111] transition hover:border-[#d4af37]"
          >
            <input
              type="radio"
              name={name}
              value={option}
              required={required}
              disabled={disabled}
              checked={value !== undefined ? value === option : undefined}
              onChange={() => onChange?.(option)}
              className="h-4 w-4 accent-[#11518b]"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

