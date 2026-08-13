import type { Metadata } from "next";
import type { ReactNode } from "react";
import { sql } from "@/lib/db";
import { isProductionInternalCanaryCapabilityEnabled, isPublicSigningEnabled } from "@/lib/signatures/public-config";

export const metadata:Metadata={robots:{index:false,follow:false,nocache:true}};

export default async function SignatureAdminLayout({children}:{children:ReactNode}){
  const publicFlag=isPublicSigningEnabled(),canaryFlag=isProductionInternalCanaryCapabilityEnabled();let canaryAuthorization=false;
  try{const rows=await sql<{authorized:boolean}[]>`SELECT EXISTS(SELECT 1 FROM signature_launch_authorizations WHERE environment='production' AND authorization_type='internal_canary' AND status='active' AND expires_at>now()) authorized`;canaryAuthorization=rows[0]?.authorized===true}catch{canaryAuthorization=false}
  const canaryLabel=canaryFlag?"Activado con validación server-side":canaryAuthorization?"Autorizado · desactivado":"Desactivado";
  return <div className="min-w-0"><aside aria-label="Estado de activación de firmas" className="mx-auto mt-3 flex w-[calc(100%-2rem)] max-w-[1416px] flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs text-slate-600 shadow-sm sm:w-[calc(100%-3rem)]"><strong className="text-slate-800">Activación</strong><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${publicFlag?"bg-red-600":"bg-emerald-600"}`} aria-hidden/><strong>Firma pública:</strong> {publicFlag?"Sujeta a validación":"Desactivada"}</span><span className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${canaryFlag?"bg-red-600":"bg-emerald-600"}`} aria-hidden/><strong>Canary interno:</strong> {canaryLabel}</span><span className="ml-auto text-slate-500">Preparado no significa habilitado</span></aside>{children}</div>;
}
