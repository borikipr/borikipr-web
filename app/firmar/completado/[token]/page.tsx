import { notFound } from "next/navigation";
import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";

export const dynamic = "force-dynamic";

export default async function CompletionAccessLanding({ params }: { params: Promise<{ token: string }> }) {
  if (!isPublicSigningEnabled()) notFound();
  const { token } = await params;
  const eligibility = await createSignatureDomainRuntime().domain.inspectCompletionAccessToken(token);
  if (!eligibility.eligible) notFound();
  return <section className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12">
    <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">BorikiPR</p>
      <h1 className="mt-2 text-2xl font-semibold">Documento completado</h1>
      <p className="mt-3 text-sm leading-6 text-slate-700">Continúa para crear una sesión privada y temporal. Abrir esta página no consume el enlace.</p>
      <form action="/api/signatures/completion/exchange" className="mt-6" method="post">
        <input name="token" type="hidden" value={token} />
        <button className="w-full rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white" type="submit">Acceder de forma segura</button>
      </form>
    </div>
  </section>;
}
