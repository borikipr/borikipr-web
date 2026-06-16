"use client";

import { useRef, useState } from "react";

const metodosCompra = ["Financiamiento", "Efectivo", "Otro"];
const evidenciaFondos = ["Sí", "No"];
const fondosCierre = ["Sí", "Parcialmente", "Aún no"];
const opcionesSiNo = ["Sí", "No"];

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const FILE_TOO_LARGE_MESSAGE =
  "El archivo excede el tamaño máximo permitido de 10 MB. Por favor, selecciona un archivo más pequeño.";

export default function FormularioPerfilComprador() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [metodoCompra, setMetodoCompra] = useState("");
  const [trabajaConCorredor, setTrabajaConCorredor] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError("");

    const form = event.currentTarget;
    const formData = new FormData(form);
    const cartaFile = formData.get("cartaPreaprobacion");

    if (cartaFile instanceof File && cartaFile.size > MAX_UPLOAD_SIZE_BYTES) {
      setError(FILE_TOO_LARGE_MESSAGE);
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

      setSuccess(true);
      setMetodoCompra("");
      formRef.current?.reset();
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
            helper="Opcional. PDF o imagen, máximo 10MB."
            name="cartaPreaprobacion"
          />
        </div>
      )}

      {metodoCompra === "Otro" && (
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

      {metodoCompra === "Efectivo" && (
        <div className="rounded-2xl border border-[#e8e8e8] bg-[#f8f8f8] p-5">
          <ChoiceGroup
            legend="¿Cuenta con evidencia de fondos disponible?"
            name="evidenciaFondos"
            options={evidenciaFondos}
            columns="sm:grid-cols-3"
          />
        </div>
      )}

      <SectionHeader title="Preparación financiera" />
      <ChoiceGroup
        legend="¿Cuenta con fondos para el pronto (down payment) y gastos de cierre?"
        name="fondosCierre"
        options={fondosCierre}
        columns="sm:grid-cols-3"
      />

      <SectionHeader title="Información adicional" />
      <ChoiceGroup
        legend="¿Está trabajando actualmente con otro corredor/realtor?"
        name="trabajaConCorredor"
        options={opcionesSiNo}
        value={trabajaConCorredor}
        onChange={setTrabajaConCorredor}
        columns="sm:grid-cols-2"
      />

      <div className={trabajaConCorredor === "Sí" ? "grid gap-5 md:grid-cols-2" : "hidden"}>
        <Field label="Nombre" htmlFor="nombreCorredor">
          <input
            id="nombreCorredor"
            name="nombreCorredor"
            type="text"
            className="input-premium"
            placeholder="Nombre completo del corredor o realtor"
            disabled={trabajaConCorredor !== "Sí"}
          />
        </Field>

        <Field label="Teléfono" htmlFor="telefonoCorredor">
          <input
            id="telefonoCorredor"
            name="telefonoCorredor"
            type="tel"
            className="input-premium"
            placeholder="(787) 123-4567"
            disabled={trabajaConCorredor !== "Sí"}
          />
        </Field>
      </div>

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
  options: string[];
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
        {options.map((option) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff]"
          >
            <input
              type={type}
              name={name}
              value={option}
              required={required}
              checked={value === undefined ? undefined : value === option}
              onChange={() => onChange?.(option)}
              className="h-4 w-4 border-[#d9d9d9] accent-[#11518b]"
            />
            <span>{option}</span>
          </label>
        ))}
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
