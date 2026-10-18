"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ATTENDANCE_OPTIONS,
  FINANCING_STATUS_OPTIONS,
  HACIENDA_SHOWING_CUTOFF_ISO,
  PROPERTY_INTEREST_OPTIONS,
  PURCHASE_METHOD_OPTIONS,
  REALTOR_OPTIONS,
} from "@/lib/hacienda-monte-carmelo-showing";

type Props = { initiallyClosed: boolean };

export default function HaciendaMonteCarmeloShowingForm({ initiallyClosed }: Props) {
  const [closed, setClosed] = useState(initiallyClosed);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [purchaseMethod, setPurchaseMethod] = useState("");
  const [financingStatus, setFinancingStatus] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [otherInterest, setOtherInterest] = useState("");
  const [worksWithRealtor, setWorksWithRealtor] = useState("");
  const [realtorName, setRealtorName] = useState("");
  const [realtorPhone, setRealtorPhone] = useState("");
  const submittingRef = useRef(false);

  useEffect(() => {
    if (closed) return;
    const remaining = Date.parse(HACIENDA_SHOWING_CUTOFF_ISO) - Date.now();
    if (remaining <= 0) {
      setClosed(true);
      return;
    }
    const timer = window.setTimeout(() => setClosed(true), Math.min(remaining, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [closed]);

  if (closed) return <ClosedState />;

  if (success) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-6 py-10 text-center text-emerald-950" role="status">
        <h2 className="text-2xl font-bold">Gracias por completar el formulario.</h2>
        <p className="mt-4 leading-7">Hemos recibido tu información relacionada con Hacienda Monte Carmelo.</p>
        <p className="mt-2 leading-7">Erickson Real Estate PR agradece tu interés.</p>
      </div>
    );
  }

  const financingRequired = purchaseMethod === "Mediante financiamiento";
  const otherSelected = interests.includes("Otro interés");
  const realtorRequired = worksWithRealtor === "Sí";

  function changePurchaseMethod(value: string) {
    setPurchaseMethod(value);
    if (value !== "Mediante financiamiento") setFinancingStatus("");
  }

  function changeRealtor(value: string) {
    setWorksWithRealtor(value);
    if (value !== "Sí") {
      setRealtorName("");
      setRealtorPhone("");
    }
  }

  function toggleInterest(value: string, checked: boolean) {
    setInterests((current) =>
      checked ? [...current, value] : current.filter((item) => item !== value)
    );
    if (value === "Otro interés" && !checked) setOtherInterest("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      name: String(data.get("name") || ""),
      phone: String(data.get("phone") || ""),
      email: String(data.get("email") || ""),
      attendance: String(data.get("attendance") || ""),
      purchaseMethod,
      financingStatus: financingRequired ? financingStatus : "",
      interests,
      otherInterest: otherSelected ? otherInterest : "",
      worksWithRealtor,
      realtorName: realtorRequired ? realtorName : "",
      realtorPhone: realtorRequired ? realtorPhone : "",
      comments: String(data.get("comments") || ""),
      privacyAcknowledged: data.get("privacyAcknowledged") === "on",
      website: String(data.get("website") || ""),
    };

    try {
      const response = await fetch("/api/hacienda-monte-carmelo-showing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        if (response.status === 410) setClosed(true);
        throw new Error(result?.error || "No pudimos enviar tu información. Intenta nuevamente.");
      }
      setSuccess(true);
    } catch (caught) {
      if (!closed) {
        setError(caught instanceof Error ? caught.message : "No pudimos enviar tu información. Intenta nuevamente.");
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <form
      action="/api/hacienda-monte-carmelo-showing"
      method="post"
      onSubmit={handleSubmit}
      className="space-y-9"
      data-clarity-mask="true"
    >
      <div className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden" aria-hidden="true">
        <label htmlFor="website">Sitio web</label>
        <input id="website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <FormSection number="A" title="Información de contacto">
        <div className="grid gap-5 md:grid-cols-2">
          <Field label="Nombre completo" htmlFor="name" required className="md:col-span-2">
            <input id="name" name="name" type="text" autoComplete="name" maxLength={120} required className="input-premium" />
          </Field>
          <Field label="Teléfono" htmlFor="phone" required>
            <input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} required className="input-premium" />
          </Field>
          <Field label="Correo electrónico" htmlFor="email" required>
            <input id="email" name="email" type="email" inputMode="email" autoComplete="email" maxLength={254} required className="input-premium" />
          </Field>
        </div>
      </FormSection>

      <FormSection number="B" title="Asistencia">
        <RadioGroup legend="¿Asistirás al Showing este domingo, 25 de octubre, a las 10:00 a. m.?" name="attendance" options={ATTENDANCE_OPTIONS} required />
      </FormSection>

      <FormSection number="C" title="Intención de compra">
        <RadioGroup legend="¿Cómo contemplas adquirir la propiedad?" name="purchaseMethod" options={PURCHASE_METHOD_OPTIONS} value={purchaseMethod} onChange={changePurchaseMethod} required />
      </FormSection>

      {financingRequired && (
        <FormSection number="D" title="Financiamiento">
          <RadioGroup legend="Si tu compra sería mediante financiamiento, ¿cuál es tu situación actual?" name="financingStatus" options={FINANCING_STATUS_OPTIONS} value={financingStatus} onChange={setFinancingStatus} required />
        </FormSection>
      )}

      <FormSection number="E" title="Intereses en la propiedad">
        <fieldset className="space-y-3">
          <legend className="text-base font-semibold text-[#0d1b2a]">¿Qué es lo que más te interesa de Hacienda Monte Carmelo?</legend>
          <p className="text-sm text-[#5b6670]">Puedes seleccionar varias opciones.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {PROPERTY_INTEREST_OPTIONS.map((option) => (
              <ChoiceLabel key={option}>
                <input type="checkbox" name="interests" value={option} checked={interests.includes(option)} onChange={(event) => toggleInterest(option, event.target.checked)} className="h-5 w-5 shrink-0 accent-[#11518b]" />
                <span>{option}</span>
              </ChoiceLabel>
            ))}
          </div>
        </fieldset>
        {otherSelected && (
          <Field label="Cuéntanos sobre ese otro interés (opcional)" htmlFor="otherInterest">
            <input id="otherInterest" name="otherInterest" type="text" maxLength={160} value={otherInterest} onChange={(event) => setOtherInterest(event.target.value)} className="input-premium" />
          </Field>
        )}
      </FormSection>

      <FormSection number="F" title="Representación por corredor">
        <RadioGroup legend="¿Estás trabajando actualmente con otro corredor o Realtor®?" name="worksWithRealtor" options={REALTOR_OPTIONS} value={worksWithRealtor} onChange={changeRealtor} required />
        {realtorRequired && (
          <div className="grid gap-5 md:grid-cols-2">
            <Field label="Nombre completo del corredor o Realtor®" htmlFor="realtorName" required>
              <input id="realtorName" name="realtorName" type="text" autoComplete="name" maxLength={120} value={realtorName} onChange={(event) => setRealtorName(event.target.value)} required className="input-premium" />
            </Field>
            <Field label="Número de teléfono del corredor o Realtor®" htmlFor="realtorPhone" required>
              <input id="realtorPhone" name="realtorPhone" type="tel" inputMode="tel" autoComplete="tel" maxLength={40} value={realtorPhone} onChange={(event) => setRealtorPhone(event.target.value)} required className="input-premium" />
            </Field>
          </div>
        )}
      </FormSection>

      <FormSection number="G" title="Comentarios">
        <Field label="¿Hay alguna pregunta o información que desees compartir antes de la visita?" htmlFor="comments">
          <textarea id="comments" name="comments" rows={5} maxLength={1200} className="input-premium min-h-32 resize-y" />
        </Field>
      </FormSection>

      <div className="rounded-2xl border border-[#d8e4ee] bg-[#f4f8fb] p-5 text-sm leading-6 text-[#34485a]">
        <p>La información será recibida por Erickson Real Estate PR para coordinar la asistencia al Showing, responder consultas sobre la propiedad y dar seguimiento relacionado con Hacienda Monte Carmelo.</p>
        <p className="mt-2">Consulta nuestra <Link href="/privacidad" className="font-semibold text-[#11518b] underline underline-offset-2">política de privacidad</Link>.</p>
        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 font-semibold text-[#0d1b2a]">
          <input type="checkbox" name="privacyAcknowledged" required className="mt-1 h-5 w-5 shrink-0 accent-[#11518b]" />
          <span>Confirmo que leí este aviso y autorizo el uso de mi información para los fines descritos. <span className="text-red-600" aria-hidden="true">*</span></span>
        </label>
      </div>

      {error && <div role="alert" aria-live="assertive" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div>}

      <button type="submit" disabled={submitting} className="btn-primary min-h-12 w-full justify-center px-6 py-3.5 text-base disabled:cursor-not-allowed disabled:opacity-60">
        {submitting ? "Enviando información…" : "Confirmar y enviar información"}
      </button>
      <p className="text-center text-xs leading-5 text-[#66727d]">El envío queda registrado únicamente cuando el proveedor acepta el correo. No se guarda una copia en una base de datos.</p>
    </form>
  );
}

export function ClosedState() {
  return (
    <div className="rounded-3xl border border-[#d4af37] bg-[#fff9e6] px-6 py-10 text-center text-[#0d1b2a]" role="status">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#765f12]">Registro finalizado</p>
      <h2 className="mt-4 text-2xl font-bold">El período de registro para el Showing de Hacienda Monte Carmelo ha concluido.</h2>
      <p className="mx-auto mt-4 max-w-xl leading-7">Para información adicional sobre la propiedad, puedes comunicarte directamente con Erickson Real Estate PR.</p>
    </div>
  );
}

function FormSection({ number, title, children }: { number: string; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border-t border-[#e4e8eb] pt-8 first:border-t-0 first:pt-0">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#11518b] text-sm font-bold text-white" aria-hidden="true">{number}</span>
        <h2 className="text-xl font-bold text-[#11518b]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Field({ label, htmlFor, required, className = "", children }: { label: string; htmlFor: string; required?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-[#0d1b2a]">{label} {required && <span className="text-red-600" aria-hidden="true">*</span>}</label>
      {children}
    </div>
  );
}

function RadioGroup({ legend, name, options, required, value, onChange }: { legend: string; name: string; options: readonly string[]; required?: boolean; value?: string; onChange?: (value: string) => void }) {
  return (
    <fieldset className="min-w-0 space-y-3">
      <legend className="text-base font-semibold leading-6 text-[#0d1b2a]">{legend} {required && <span className="text-red-600" aria-hidden="true">*</span>}</legend>
      <div className="grid gap-3">
        {options.map((option) => (
          <ChoiceLabel key={option}>
            <input type="radio" name={name} value={option} required={required} checked={value !== undefined ? value === option : undefined} onChange={() => onChange?.(option)} className="h-5 w-5 shrink-0 accent-[#11518b]" />
            <span>{option}</span>
          </ChoiceLabel>
        ))}
      </div>
    </fieldset>
  );
}

function ChoiceLabel({ children }: { children: React.ReactNode }) {
  return <label className="flex min-h-12 cursor-pointer items-start gap-3 rounded-2xl border border-[#d9dee2] bg-white px-4 py-3 text-sm font-medium leading-6 text-[#263746] transition hover:border-[#d4af37] focus-within:border-[#11518b] focus-within:ring-2 focus-within:ring-[#11518b]/20">{children}</label>;
}
