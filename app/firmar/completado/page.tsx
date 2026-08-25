import { notFound } from "next/navigation";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";

export default async function SigningCompletedPage({searchParams}:{searchParams:Promise<{document?:string}>}) {
  if (!isSignerRuntimeEnabled()) notFound();
  const finalDocument=(await searchParams).document==="completed";
  return <section className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12"><div className="w-full rounded-2xl border border-emerald-200 bg-white p-6 shadow-sm"><div aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-800">✓</div><h1 className="mt-4 text-2xl font-semibold">Firma completada</h1><p className="mt-3 leading-7 text-slate-700">{finalDocument?"El documento ha sido completado.":"Tu participación está completada. El documento continuará con los demás firmantes."}</p><p className="mt-3 text-sm text-slate-600">No tienes que realizar ninguna otra acción. La sesión privada fue cerrada.</p><time className="mt-4 block text-xs text-slate-500" dateTime={new Date().toISOString()} suppressHydrationWarning>{new Date().toLocaleString("es-PR",{timeZone:"America/Puerto_Rico"})} · Hora de Puerto Rico</time></div></section>;
}
