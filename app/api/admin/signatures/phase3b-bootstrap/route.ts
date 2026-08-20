import { getAdminSession } from "@/lib/admin/auth";
import { bootstrapPhase3BTemplates } from "@/lib/signatures/phase3b-bootstrap";
import { sameSignerOrigin } from "@/lib/signatures/signer/origin";

export const runtime="nodejs";export const dynamic="force-dynamic";
const CONFIRM="CONFIGURAR TRES PLANTILLAS INICIALES";
export async function POST(request:Request){const session=await getAdminSession();if(!session||!sameSignerOrigin(request))return new Response(null,{status:404});
  const origin=request.headers.get("origin")??request.url;try{const form=await request.formData();if(form.get("confirmation")!==CONFIRM)throw new Error("confirmation_required");
    const values={offer:String(form.get("offer")??""),buyerInfo:String(form.get("buyerInfo")??""),option:String(form.get("option")??"")};if(!Object.values(values).every((value)=>/^[0-9a-f-]{36}$/.test(value)))throw new Error("invalid_id");
    await bootstrapPhase3BTemplates({...values,actorAdminId:session.id});return Response.redirect(new URL("/admin/signatures/plantillas?configured=1",origin),303);
  }catch{return Response.redirect(new URL("/admin/signatures/configuracion?phase3b=error",origin),303);}}
