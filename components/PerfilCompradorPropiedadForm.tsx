"use client";

import { useEffect, useRef, useState } from "react";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { MAX_OPEN_HOUSE_DOCUMENT_BYTES } from "@/lib/leads/open-house-registration";

const allowedDocumentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
]);

type ReuseState = "idle" | "checking" | "available" | "unavailable";

export default function PerfilCompradorPropiedadForm({
  propiedadId,
  propiedadSlug,
  showingAt,
  requiresSolarContractAcceptance,
  r2Configured,
}: {
  propiedadId: string;
  propiedadSlug: string;
  showingAt: string;
  requiresSolarContractAcceptance: boolean;
  r2Configured: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [metodoCompra, setMetodoCompra] = useState("");
  const [trabajaCorredor, setTrabajaCorredor] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [documentReuseState, setDocumentReuseState] =
    useState<ReuseState>("idle");

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setMessage("");
    setError("");

    const formData = new FormData(event.currentTarget);
    formData.set("propiedad_id", propiedadId);
    formData.set("propertyId", propiedadId);
    formData.set("propertySlug", propiedadSlug);
    formData.set("showingAt", showingAt);
    formData.set("idempotencyKey", idempotencyKey || crypto.randomUUID());

    const requiresFinancialDocument =
      metodoCompra === "Financiamiento" || metodoCompra === "Cash";
    const applicableFile =
      metodoCompra === "Financiamiento"
        ? formData.get("carta_precalificacion")
        : metodoCompra === "Cash"
          ? formData.get("evidencia_fondos_archivo")
          : null;
    const hasFile =
      applicableFile instanceof File && applicableFile.size > 0;

    if (
      hasFile &&
      applicableFile instanceof File &&
      !allowedDocumentTypes.has(applicableFile.type)
    ) {
      setError("Solo se aceptan PDF e imágenes JPG, PNG o WebP.");
      setPending(false);
      return;
    }
    if (
      hasFile &&
      applicableFile instanceof File &&
      applicableFile.size > MAX_OPEN_HOUSE_DOCUMENT_BYTES
    ) {
      setError("El archivo excede el máximo permitido de 10 MB.");
      setPending(false);
      return;
    }

    if (
      requiresFinancialDocument &&
      !hasFile &&
      documentReuseState !== "available"
    ) {
      const reusable = await checkReusableDocument(event.currentTarget);
      if (!reusable) {
        setError(
          metodoCompra === "Financiamiento"
            ? "Adjunta la carta de precalificación requerida."
            : "Adjunta la evidencia de fondos requerida."
        );
        setPending(false);
        return;
      }
    }

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

      setMessage("Gracias. Tu asistencia quedó confirmada correctamente.");
      formRef.current?.reset();
      setMetodoCompra("");
      setTrabajaCorredor("");
      setDocumentReuseState("idle");
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setPending(false);
    }
  };

  const resetDocumentReuse = () => setDocumentReuseState("idle");

  async function checkReusableDocument(form = formRef.current) {
    if (
      !form ||
      (metodoCompra !== "Financiamiento" && metodoCompra !== "Cash")
    ) {
      return false;
    }
    const data = new FormData(form);
    const name = String(data.get("nombre") || "").trim();
    const phone = String(data.get("telefono") || "").trim();
    const email = String(data.get("email") || "").trim();
    if (!name || !phone) {
      setDocumentReuseState("unavailable");
      return false;
    }
    setDocumentReuseState("checking");
    try {
      const response = await fetch("/api/consultas-propiedad/document-status", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          purchaseMethod: metodoCompra,
        }),
      });
      const result = await response.json();
      const reusable = response.ok && result.reusable === true;
      setDocumentReuseState(reusable ? "available" : "unavailable");
      return reusable;
    } catch {
      setDocumentReuseState("unavailable");
      return false;
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {!r2Configured && (
        <div className="rounded-xl border border-[#d4af37] bg-[#fff9e6] p-4 text-sm text-[#4d4d4d]">
          La carga segura de documentos no está disponible en este momento.
          Podrás continuar únicamente si confirmamos un documento financiero
          existente asociado con tu perfil.
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <Field
          label="Nombre completo"
          name="nombre"
          required
          onInput={resetDocumentReuse}
        />
        <Field
          label="Teléfono"
          name="telefono"
          type="tel"
          required
          onInput={resetDocumentReuse}
        />
        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          onInput={resetDocumentReuse}
        />

        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#000000]">
            Método de compra <span className="text-red-500">*</span>
          </legend>
          <div className="grid gap-2 sm:grid-cols-3">
            {[
              { label: "Financiamiento", value: "Financiamiento" },
              { label: "Cash", value: "Cash" },
              { label: "Otros", value: "Otro" },
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
                  onChange={(event) => {
                    setMetodoCompra(event.target.value);
                    setDocumentReuseState("idle");
                  }}
                  className="h-4 w-4 border-[#d9d9d9] accent-[#11518b]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {metodoCompra === "Otro" && (
        <Field
          label="Especifique"
          name="metodoCompraOtro"
          required
          placeholder="Indique el método o programa de compra"
        />
      )}

      {metodoCompra === "Financiamiento" && (
        <FinancialDocumentField
          key="financing-document"
          label="Carta de precalificación"
          name="carta_precalificacion"
          r2Configured={r2Configured}
          reuseState={documentReuseState}
          onCheck={() => checkReusableDocument()}
        />
      )}

      {metodoCompra === "Cash" && (
        <FinancialDocumentField
          key="cash-document"
          label="Evidencia de fondos"
          name="evidencia_fondos_archivo"
          r2Configured={r2Configured}
          reuseState={documentReuseState}
          onCheck={() => checkReusableDocument()}
        />
      )}

      <div className="grid gap-5 md:grid-cols-2">
        <RadioGroup
          legend="¿Podrá asistir al Open House en la fecha y hora indicadas?"
          name="disponibilidad_visita"
          options={["Sí", "No"]}
        />
        <RadioGroup
          legend="¿Cuenta con fondos para el pronto y los gastos de cierre?"
          name="fondos_gastos_cierre"
          options={["Sí", "Parcialmente", "Aún no"]}
        />
      </div>

      <div className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#000000]">
            ¿Está trabajando actualmente con otro corredor/Realtor?
          </legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: "Sí", value: "Sí" },
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
                  required
                  checked={trabajaCorredor === option.value}
                  onChange={(event) => setTrabajaCorredor(event.target.value)}
                  className="h-4 w-4 border-[#d9d9d9] accent-[#11518b]"
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {trabajaCorredor === "Sí" && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nombre del corredor" name="nombre_corredor" required />
            <Field
              label="Teléfono del corredor"
              name="telefono_corredor"
              type="tel"
              required
            />
          </div>
        )}
      </div>

      {requiresSolarContractAcceptance && (
        <RadioGroup
          legend="Esta propiedad tiene placas solares con contrato o leasing vigente. ¿Estaría dispuesto(a) a asumir ese contrato o leasing como parte de la compra?"
          name="solarContractAcceptance"
          options={[
            { label: "Sí", value: "yes" },
            { label: "No", value: "no" },
          ]}
        />
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

      <button
        type="submit"
        disabled={pending}
        className="btn-primary w-full justify-center py-3.5 disabled:opacity-60"
      >
        {pending ? "Enviando..." : "Confirmar asistencia"}
      </button>
    </form>
  );
}

function RadioGroup({
  legend,
  name,
  options,
}: {
  legend: string;
  name: string;
  options: Array<string | { label: string; value: string }>;
}) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-sm font-semibold text-[#000000]">
        {legend} <span className="text-red-500">*</span>
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { label: option, value: option }
              : option;
          return (
            <label
              key={item.value}
              className="flex min-h-11 min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff]"
            >
              <input
                type="radio"
                name={name}
                value={item.value}
                required
                className="h-4 w-4 shrink-0 border-[#d9d9d9] accent-[#11518b]"
              />
              <span className="break-words">{item.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  disabled,
  onInput,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onInput?: () => void;
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
        onInput={onInput}
        className="input-premium disabled:bg-[#eeeeee]"
      />
    </div>
  );
}

function FinancialDocumentField({
  label,
  name,
  r2Configured,
  reuseState,
  onCheck,
}: {
  label: string;
  name: string;
  r2Configured: boolean;
  reuseState: ReuseState;
  onCheck: () => void;
}) {
  const reusable = reuseState === "available";
  return (
    <div className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-[#f8f8f8] p-5">
      <p className="text-sm leading-relaxed text-[#4d4d4d]">
        Este documento financiero es requerido. Si ya está asociado de forma
        segura con tu perfil de comprador, podrás continuar sin subirlo otra vez.
      </p>
      <button
        type="button"
        onClick={onCheck}
        disabled={reuseState === "checking"}
        className="inline-flex min-h-11 items-center justify-center rounded-xl border border-[#11518b] px-4 py-2 text-sm font-semibold text-[#11518b] disabled:cursor-wait disabled:opacity-60"
      >
        {reuseState === "checking"
          ? "Verificando…"
          : "Verificar documento existente"}
      </button>
      {reusable && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
        >
          Ya tenemos el documento financiero requerido asociado con tu perfil
          de comprador. No necesitas subirlo nuevamente.
        </div>
      )}
      {reuseState === "unavailable" && (
        <div
          role="status"
          className="rounded-xl border border-[#d4af37] bg-[#fff9e6] p-4 text-sm text-[#4d4d4d]"
        >
          No pudimos confirmar un documento reutilizable. Adjunta el archivo
          requerido para completar el registro.
        </div>
      )}
      <UploadField
        label={label}
        name={name}
        required={reuseState === "unavailable" && r2Configured}
        showRequired
        disabled={reusable || !r2Configured}
      />
    </div>
  );
}

function UploadField({
  label,
  name,
  required,
  showRequired,
  disabled,
}: {
  label: string;
  name: string;
  required?: boolean;
  showRequired?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={name} className="text-sm font-semibold text-[#000000]">
        {label}{" "}
        {(required || showRequired) && <span className="text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp,image/jpg"
        required={required}
        aria-required={showRequired || required}
        disabled={disabled}
        className="block w-full rounded-xl border border-[#d9d9d9] bg-white px-4 py-3 text-sm text-[#333333] file:mr-4 file:rounded-full file:border-0 file:bg-[#11518b] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white disabled:bg-[#eeeeee]"
      />
    </div>
  );
}
