import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";
import { createSignerRepository } from "@/lib/signatures/signer/repository";
import { requireSignerRequestContext } from "@/lib/signatures/signer/request";
import { SIGNER_CSRF_COOKIE_NAME } from "@/lib/signatures/signer/cookie";
import { sha256SignatureValue } from "@/lib/signatures/domain/crypto";
import SignerFieldForm from "./SignerFieldForm";
import SignerDocumentViewer from "./SignerDocumentViewer";
import SignerActionForm from "./SignerActionForm";
import SignerRequiredFieldNavigator from "./SignerRequiredFieldNavigator";

export const dynamic = "force-dynamic";

export default async function SignerSessionPage() {
  if (!isSignerRuntimeEnabled()) notFound();
  try {
    const signer = await requireSignerRequestContext({ touch: true });
    const csrf = (await cookies()).get(SIGNER_CSRF_COOKIE_NAME)?.value;
    if (!csrf) notFound();
    const view = await createSignerRepository(signer.runtime.database).view(
      signer.context.documentVersionId,
      signer.context.participantId,
    );
    if (
      !view ||
      !view.consent_text ||
      !view.consent_text_sha256 ||
      !view.consent_locale
    )
      notFound();
    const privacyText =
      view.consent_locale === "es-PR"
        ? view.privacy_disclosure_es_pr_text
        : view.privacy_disclosure_en_us_text;
    if (!privacyText) notFound();
    if (
      sha256SignatureValue(privacyText) !==
      (view.consent_locale === "es-PR"
        ? view.privacy_disclosure_es_pr_sha256
        : view.privacy_disclosure_en_us_sha256)
    )
      notFound();
    const consented = view.participant_status === "consented";
    return (
      <section className="signer-session-shell">
        <header className="signer-session-header">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.1em] text-[#11518b]">
              Borikí Sign · {view.role}
            </p>
            <h1 className="mt-1 text-xl font-semibold sm:text-2xl">
              {view.title}
            </h1>
          </div>
          <p className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold">
            {view.fields.filter((field) => field.completed).length} /{" "}
            {view.fields.length} campos
          </p>
        </header>
        {!consented ? (
          <div className="mt-6 space-y-4">
            <section
              className="rounded-xl border border-slate-300 bg-white p-5"
              aria-labelledby="signing-privacy-heading"
            >
              <h2 id="signing-privacy-heading" className="font-semibold">
                Aviso de privacidad para firma
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {privacyText}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Versión: {view.privacy_disclosure_version}
              </p>
            </section>
            <SignerActionForm
              action="/api/signatures/session/consent"
              destination="/firmar/sesion"
              errorMessage="No se pudo registrar el consentimiento. Verifica que la sesión siga vigente e intenta nuevamente."
              className="rounded-xl border-2 border-amber-300 bg-amber-50 p-5"
            >
              <h2 className="font-semibold">Consentimiento electrónico</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                {view.consent_text}
              </p>
              <p className="mt-2 text-xs text-slate-600">
                Versión: {signer.context.consentVersion}
              </p>
              <input type="hidden" name="csrf" value={csrf} />
              <button className="mt-4 rounded-lg bg-slate-950 px-4 py-2 text-white">
                Acepto expresamente y deseo continuar
              </button>
            </SignerActionForm>
          </div>
        ) : (
          <>
            <SignerRequiredFieldNavigator fields={view.fields} />
            <div className="signer-workspace-grid">
              <SignerDocumentViewer pageCount={view.page_count} />
              <aside
                className="signer-fields-panel"
                aria-label="Campos para completar"
              >
                <div className="mb-4">
                  <p className="text-xs font-bold uppercase tracking-[.08em] text-slate-500">
                    Tus campos
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">
                    Completa y firma
                  </h2>
                </div>
                <ol className="space-y-3">
                  {view.fields.map((field) => (
                    <li
                      id={`signer-field-${field.id}`}
                      key={field.id}
                      tabIndex={-1}
                    >
                      <SignerFieldForm
                        field={field}
                        csrf={csrf}
                        participantName={view.participant_name}
                      />
                    </li>
                  ))}
                </ol>
              </aside>
            </div>
            <SignerActionForm
              action="/api/signatures/session/complete"
              destination="/firmar/completado"
              errorMessage="No se pudo completar la participación. Revisa los campos e intenta nuevamente."
              className="signer-complete-bar"
            >
              <input type="hidden" name="csrf" value={csrf} />
              <button className="min-h-12 w-full rounded-lg bg-emerald-700 px-5 py-3 font-semibold text-white sm:w-auto">
                Finalizar
              </button>
            </SignerActionForm>
          </>
        )}
      </section>
    );
  } catch {
    notFound();
  }
}
