import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";
import { COMPLETION_COOKIE_NAME, parseSignerCookie } from "@/lib/signatures/signer/cookie";
import { assertSignerAccessAuthorized } from "@/lib/signatures/canary-gate";

export const dynamic = "force-dynamic";

export default async function CompletedFilesPage() {
  if (!isSignerRuntimeEnabled()) notFound();
  const parsed = parseSignerCookie((await cookies()).get(COMPLETION_COOKIE_NAME)?.value);
  if (!parsed) notFound();
  let title: string;
  try {
    const runtime=createSignatureDomainRuntime();
    const context = await runtime.domain.getSessionContext({ ...parsed, purpose: "completed_document_access", touch: true });
    await assertSignerAccessAuthorized(runtime.database,{participantId:context.participantId,documentVersionId:context.documentVersionId});
    title = context.title;
  } catch { notFound(); }
  return <section className="mx-auto max-w-xl px-5 py-16"><h1 className="text-2xl font-semibold">Archivos completados</h1><p className="mt-3 text-sm text-slate-700">{title}</p><div className="mt-6 grid gap-3"><Link className="rounded-lg bg-slate-950 px-4 py-3 text-center font-semibold text-white" href="/firmar/completado/archivos/document">Descargar documento firmado</Link><Link className="rounded-lg border border-slate-400 px-4 py-3 text-center font-semibold" href="/firmar/completado/archivos/certificate">Descargar certificado</Link></div></section>;
}
