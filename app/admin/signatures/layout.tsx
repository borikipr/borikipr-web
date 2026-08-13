import type { Metadata } from "next";
import type { ReactNode } from "react";
import { sql } from "@/lib/db";
import { isProductionInternalCanaryCapabilityEnabled, isPublicSigningEnabled } from "@/lib/signatures/public-config";

export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

export default async function SignatureAdminLayout({children}:{children:ReactNode}){
  const publicFlag=isPublicSigningEnabled(),canaryFlag=isProductionInternalCanaryCapabilityEnabled();let canaryAuthorization=false;
  try{const rows=await sql<{authorized:boolean}[]>`SELECT EXISTS(SELECT 1 FROM signature_launch_authorizations WHERE environment='production' AND authorization_type='internal_canary' AND status='active' AND expires_at>now()) authorized`;canaryAuthorization=rows[0]?.authorized===true}catch{canaryAuthorization=false}
  const canaryLabel=canaryFlag?"Activado con validación server-side":canaryAuthorization?"Autorizado · desactivado":"Desactivado";
  return <div className="min-w-0"><aside aria-label="Estado de activación de firmas" className="mx-auto mb-2 flex w-full max-w-[1440px] flex-wrap gap-x-5 gap-y-1 px-4 pt-3 text-xs text-slate-600 sm:px-6"><span><strong>Firma pública:</strong> <span className={publicFlag?"text-red-800":"text-green-800"}>{publicFlag?"Sujeta a validación":"Desactivada"}</span></span><span><strong>Canary interno:</strong> <span className={canaryFlag?"text-red-800":"text-green-800"}>{canaryLabel}</span></span><span className="text-slate-500">READY no significa habilitado</span></aside>{children}</div>;
}
