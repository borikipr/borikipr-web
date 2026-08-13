import type { Metadata } from "next";
import type { ReactNode } from "react";
import { sql } from "@/lib/db";
import { isProductionInternalCanaryCapabilityEnabled, isPublicSigningEnabled } from "@/lib/signatures/public-config";

export const metadata: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

export default async function SignatureAdminLayout({ children }: { children: ReactNode }) {
  const publicFlag=isPublicSigningEnabled();
  const canaryFlag=isProductionInternalCanaryCapabilityEnabled();
  let canaryAuthorization=false;
  try {
    const rows=await sql<{authorized:boolean}[]>`SELECT EXISTS(SELECT 1 FROM signature_launch_authorizations
      WHERE environment='production' AND authorization_type='internal_canary' AND status='active' AND expires_at>now()) authorized`;
    canaryAuthorization=rows[0]?.authorized===true;
  } catch { canaryAuthorization=false; }
  const canaryLabel=canaryFlag
    ? "BLOQUEADO HASTA VALIDACIÓN SERVER-SIDE"
    : canaryAuthorization ? "AUTORIZADO / DESACTIVADO" : "DESACTIVADO";
  return <div className="min-w-0">
    <aside aria-label="Estado de activación de firmas" className="mx-auto mb-4 grid w-full max-w-[1440px] gap-2 px-4 pt-3 text-xs sm:grid-cols-3 sm:px-6">
      <div className="rounded-lg border border-slate-300 bg-white px-3 py-2"><strong>Entorno</strong><span className="ml-2 text-red-800">Producción</span></div>
      <div className="rounded-lg border border-slate-300 bg-white px-3 py-2"><strong>FIRMA PÚBLICA</strong><span className={`ml-2 ${publicFlag?"text-red-800":"text-green-800"}`}>{publicFlag?"BLOQUEADA HASTA VALIDACIÓN":"DESACTIVADA"}</span></div>
      <div className="rounded-lg border border-slate-300 bg-white px-3 py-2"><strong>CANARY INTERNO</strong><span className={`ml-2 ${canaryFlag?"text-red-800":"text-green-800"}`}>{canaryLabel}</span></div>
    </aside>
    {children}
  </div>;
}
