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

type ReuseState =
  | "idle"
  | "checking"
  | "available"
  | "unavailable"
  | "error";

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
  const [useNewDocument, setUseNewDocument] = useState(false);
  const verificationAbortRef = useRef<AbortController | null>(null);
  const verificationKeyRef = useRef("");
  const verificationPromiseRef = useRef<Promise<boolean> | null>(null);
  const verificationResultRef = useRef(false);
  const verificationRequestRef = useRef(0);

  useEffect(() => {
    setIdempotencyKey(crypto.randomUUID());
    return () => verificationAbortRef.current?.abort();
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
      invalidateDocumentReuse();
      setIdempotencyKey(crypto.randomUUID());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setPending(false);
    }
  };

  function invalidateDocumentReuse() {
    verificationAbortRef.current?.abort();
    verificationAbortRef.current = null;
    verificationRequestRef.current += 1;
    verificationKeyRef.current = "";
    verificationPromiseRef.current = null;
    verificationResultRef.current = false;
    setDocumentReuseState("idle");
    setUseNewDocument(false);
  }

  async function checkReusableDocument(
    form = formRef.current,
    purchaseMethod = metodoCompra
  ) {
    if (
      !form ||
      (purchaseMethod !== "Financiamiento" && purchaseMethod !== "Cash")
    ) {
      return false;
    }
    const data = new FormData(form);
    const name = String(data.get("nombre") || "").trim();
    const phone = String(data.get("telefono") || "").trim();
    const email = String(data.get("email") || "").trim();
    if (!name || (!phone && !email)) {
      setDocumentReuseState("idle");
      return false;
    }

    const verificationKey = [
      purchaseMethod,
      name.toLocaleLowerCase("es"),
      email.toLowerCase(),
      phone.replace(/\D/g, ""),
    ].join("|");
    if (verificationKeyRef.current === verificationKey) {
      if (verificationPromiseRef.current) {
        return verificationPromiseRef.current;
      }
      return verificationResultRef.current;
    }

    verificationAbortRef.current?.abort();
    const controller = new AbortController();
    const requestId = verificationRequestRef.current + 1;
    verificationAbortRef.current = controller;
    verificationRequestRef.current = requestId;
    verificationKeyRef.current = verificationKey;
    verificationResultRef.current = false;
    setUseNewDocument(false);
    setDocumentReuseState("checking");

    const request = (async () => {
      try {
        const response = await fetch(
          "/api/consultas-propiedad/document-status",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              name,
              phone,
              email,
              purchaseMethod,
            }),
            signal: controller.signal,
          }
        );
        const result = (await response.json()) as {
          ok?: boolean;
          reusable?: boolean;
        };
        if (!response.ok || result.ok !== true) {
          throw new Error("verification_failed");
        }
        const reusable = result.reusable === true;
        if (verificationRequestRef.current === requestId) {
          verificationResultRef.current = reusable;
          setDocumentReuseState(reusable ? "available" : "unavailable");
        }
        return reusable;
      } catch (lookupError) {
        if (
          lookupError instanceof Error &&
          lookupError.name === "AbortError"
        ) {
          return false;
        }
        if (verificationRequestRef.current === requestId) {
          verificationResultRef.current = false;
          setDocumentReuseState("error");
        }
        return false;
      } finally {
        if (verificationRequestRef.current === requestId) {
          verificationAbortRef.current = null;
          verificationPromiseRef.current = null;
        }
      }
    })();
    verificationPromiseRef.current = request;
    return request;
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
          onInput={invalidateDocumentReuse}
          onBlur={() => void checkReusableDocument()}
        />
        <Field
          label="Teléfono"
          name="telefono"
          type="tel"
          required
          onInput={invalidateDocumentReuse}
          onBlur={() => void checkReusableDocument()}
        />
        <Field
          label="Correo electrónico"
          name="email"
          type="email"
          onInput={invalidateDocumentReuse}
          onBlur={() => void checkReusableDocument()}
        />
      </div>

      <fieldset className="w-full space-y-3">
        <legend className="text-sm font-semibold text-[#000000]">
          Método de compra <span className="text-red-500">*</span>
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
          {[
            { label: "Financiamiento", value: "Financiamiento" },
            { label: "Cash", value: "Cash" },
            { label: "Otros", value: "Otro" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff] sm:w-auto"
            >
              <input
                type="radio"
                name="metodo_compra"
                value={option.value}
                required
                checked={metodoCompra === option.value}
                onChange={(event) => {
                  const nextMethod = event.target.value;
                  setMetodoCompra(nextMethod);
                  invalidateDocumentReuse();
                  void checkReusableDocument(formRef.current, nextMethod);
                }}
                className="h-4 w-4 shrink-0 border-[#d9d9d9] accent-[#11518b]"
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

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
          useNewDocument={useNewDocument}
          onUseNewDocument={() => setUseNewDocument(true)}
        />
      )}

      {metodoCompra === "Cash" && (
        <FinancialDocumentField
          key="cash-document"
          label="Evidencia de fondos"
          name="evidencia_fondos_archivo"
          r2Configured={r2Configured}
          reuseState={documentReuseState}
          useNewDocument={useNewDocument}
          onUseNewDocument={() => setUseNewDocument(true)}
        />
      )}

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

      <div className="space-y-5">
        <fieldset className="space-y-3">
          <legend className="text-sm font-semibold text-[#000000]">
            ¿Está trabajando actualmente con otro corredor/Realtor?
          </legend>
          <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
            {[
              { label: "Sí", value: "Sí" },
              { label: "No", value: "No" },
            ].map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff] sm:w-auto"
              >
                <input
                  type="radio"
                  name="trabajando_con_corredor"
                  value={option.value}
                  required
                  checked={trabajaCorredor === option.value}
                  onChange={(event) => setTrabajaCorredor(event.target.value)}
                  className="h-4 w-4 shrink-0 border-[#d9d9d9] accent-[#11518b]"
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
    <fieldset className="w-full min-w-0 space-y-3">
      <legend className="text-sm font-semibold text-[#000000]">
        {legend} <span className="text-red-500">*</span>
      </legend>
      <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { label: option, value: option }
              : option;
          return (
            <label
              key={item.value}
              className="flex min-h-11 w-full min-w-0 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff] sm:w-auto"
            >
              <input
                type="radio"
                name={name}
                value={item.value}
                required
                className="h-4 w-4 shrink-0 border-[#d9d9d9] accent-[#11518b]"
              />
              <span>{item.label}</span>
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
  onBlur,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  onInput?: () => void;
  onBlur?: () => void;
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
        onBlur={onBlur}
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
  useNewDocument,
  onUseNewDocument,
}: {
  label: string;
  name: string;
  r2Configured: boolean;
  reuseState: ReuseState;
  useNewDocument: boolean;
  onUseNewDocument: () => void;
}) {
  const reusable = reuseState === "available";
  const showUpload =
    reuseState === "unavailable" ||
    reuseState === "error" ||
    useNewDocument;
  return (
    <div className="space-y-3 rounded-2xl border border-[#e8e8e8] bg-[#f8f8f8] p-5">
      <p className="text-sm leading-relaxed text-[#4d4d4d]">
        Este documento financiero es requerido. Si ya está asociado de forma
        segura con tu perfil de comprador, podrás continuar sin subirlo otra vez.
      </p>
      {reuseState === "idle" && (
        <div
          role="status"
          className="rounded-xl border border-[#d9d9d9] bg-white p-4 text-sm text-[#4d4d4d]"
        >
          Completa tu nombre y teléfono o correo electrónico para verificar
          automáticamente si ya tenemos el documento requerido.
        </div>
      )}
      {reuseState === "checking" && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-xl border border-[#d9d9d9] bg-white p-4 text-sm text-[#4d4d4d]"
        >
          Verificando si ya tienes un documento financiero registrado...
        </div>
      )}
      {reusable && !useNewDocument && (
        <div
          role="status"
          className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800"
        >
          <p>
            ✓ Encontramos un documento financiero válido asociado a tu perfil.
          </p>
          <p className="mt-1 font-normal">No necesitas volver a subirlo.</p>
          <button
            type="button"
            onClick={onUseNewDocument}
            className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-green-700 px-4 py-2 text-sm font-semibold text-green-800"
          >
            Subir un documento nuevo
          </button>
        </div>
      )}
      {reuseState === "error" && (
        <div
          role="alert"
          className="rounded-xl border border-[#d4af37] bg-[#fff9e6] p-4 text-sm text-[#4d4d4d]"
        >
          No pudimos verificar documentos previamente enviados. Por favor
          adjunta el documento requerido.
        </div>
      )}
      {showUpload && (
        <UploadField
          label={label}
          name={name}
          required={r2Configured}
          showRequired
          disabled={!r2Configured}
        />
      )}
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
