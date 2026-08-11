import { notFound } from "next/navigation";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";
import { isSignerAccessAuthorized } from "@/lib/signatures/canary-gate";

export const dynamic = "force-dynamic";

export default async function SigningLanding({ params }: { params: Promise<{ token: string }> }) {
  if (!isSignerRuntimeEnabled()) notFound();
  const { token } = await params;
  const runtime = createSignatureDomainRuntime();
  const eligibility = await runtime.domain.inspectSigningToken(token);
  if (!eligibility.eligible) notFound();
  if (!await isSignerAccessAuthorized(runtime.database, eligibility)) notFound();
  return (
    <section className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12">
      <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">BorikiPR</p>
        <h1 className="mt-2 text-2xl font-semibold">Documento privado para firma</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">
          Continúa únicamente si esperabas recibir esta solicitud. El enlace no se consume al abrir esta página.
        </p>
        <form action="/api/signatures/session/exchange" method="post" className="mt-6">
          <input type="hidden" name="token" value={token} />
          <button className="w-full rounded-lg bg-slate-950 px-4 py-3 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2">
            Continuar de forma segura
          </button>
        </form>
      </div>
    </section>
  );
}
