import { notFound } from "next/navigation";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";

export default function InvalidSigningLinkPage() {
  if (!isSignerRuntimeEnabled()) notFound();
  return <section className="mx-auto flex min-h-screen max-w-xl items-center px-5 py-12"><div className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Borikí Sign</p><h1 className="mt-2 text-2xl font-semibold">Enlace de firma no disponible</h1><p className="mt-3 text-sm leading-6 text-slate-700">El enlace no es válido o ya no está disponible. Abre la invitación más reciente que recibiste o comunícate directamente con Erickson Real Estate.</p><p className="mt-4 text-xs leading-5 text-slate-500">Por seguridad, Borikí no muestra información del documento ni de sus destinatarios en esta página.</p></div></section>;
}
