import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Image from "next/image";
import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { createSignerRepository } from "@/lib/signatures/signer/repository";
import { requireSignerRequestContext } from "@/lib/signatures/signer/request";
import { SIGNER_CSRF_COOKIE_NAME } from "@/lib/signatures/signer/cookie";
import { sha256SignatureValue } from "@/lib/signatures/domain/crypto";
import SignerFieldForm from "./SignerFieldForm";

export const dynamic = "force-dynamic";

export default async function SignerSessionPage() {
  if (!isPublicSigningEnabled()) notFound();
  try {
    const signer = await requireSignerRequestContext({ touch: true });
    const csrf = (await cookies()).get(SIGNER_CSRF_COOKIE_NAME)?.value;
    if (!csrf) notFound();
    const view = await createSignerRepository(signer.runtime.database).view(
      signer.context.documentVersionId,
      signer.context.participantId
    );
    if (!view || !view.consent_text || !view.consent_text_sha256 || !view.consent_locale) notFound();
    const privacyText = view.consent_locale === "es-PR"
      ? view.privacy_disclosure_es_pr_text
      : view.privacy_disclosure_en_us_text;
    if (!privacyText) notFound();
    if (
      sha256SignatureValue(privacyText) !== (view.consent_locale === "es-PR"
        ? view.privacy_disclosure_es_pr_sha256
        : view.privacy_disclosure_en_us_sha256)
    ) notFound();
    const consented = view.participant_status === "consented";
    return (
      <section className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">Rol: {view.role}</p>
          <h1 className="mt-1 text-2xl font-semibold">{view.title}</h1>
          <p className="mt-2 text-sm">Progreso: {view.fields.filter((field) => field.completed).length} / {view.fields.length}</p>
        </header>
        {!consented ? (
          <div className="mt-6 space-y-4">
          <section className="rounded-xl border border-slate-300 bg-white p-5" aria-labelledby="signing-privacy-heading">
            <h2 id="signing-privacy-heading" className="font-semibold">Aviso de privacidad para firma</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{privacyText}</p>
            <p className="mt-2 text-xs text-slate-600">Versión: {view.privacy_disclosure_version}</p>
          </section>
          <form action="/api/signatures/session/consent" method="post" className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5">
            <h2 className="font-semibold">Consentimiento electrónico</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{view.consent_text}</p>
            <p className="mt-2 text-xs text-slate-600">Versión: {signer.context.consentVersion}</p>
            <input type="hidden" name="csrf" value={csrf} />
            <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-white">Acepto expresamente y deseo continuar</button>
          </form>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-6">
              {Array.from({ length: view.page_count }, (_, pageIndex) => (
                <article key={pageIndex} className="relative overflow-auto rounded-xl border bg-white p-2">
                  {/* PDF.js-rendered immutable source page; overlays are participant-filtered server-side. */}
                  <Image unoptimized width={1200} height={1600} src={`/firmar/sesion/pages/${pageIndex}`} alt={`Página ${pageIndex + 1} del documento`} className="h-auto max-w-full" />
                </article>
              ))}
            </div>
            <ol className="mt-6 space-y-4">
              {view.fields.map((field) => (
                <li key={field.id}><SignerFieldForm field={field} csrf={csrf} /></li>
              ))}
            </ol>
            <form action="/api/signatures/session/complete" method="post" className="mt-6">
              <input type="hidden" name="csrf" value={csrf} />
              <button className="rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white">Completar mi participación</button>
            </form>
          </>
        )}
      </section>
    );
  } catch { notFound(); }
}
