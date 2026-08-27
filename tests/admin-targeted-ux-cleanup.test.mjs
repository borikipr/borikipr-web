import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { signatureActionPolicy } from "../lib/signatures/action-policy.ts";

const root=path.dirname(fileURLToPath(new URL("../package.json",import.meta.url)));
const source=(name)=>readFile(path.join(root,name),"utf8");

test("Signing actions use an accessible portaled menu and state-aware policy",async()=>{
  const [menu,detail,list]=await Promise.all([source("components/admin/signatures/SignatureActionsMenu.tsx"),source("components/admin/signatures/SignatureDocumentActions.tsx"),source("app/admin/signatures/page.tsx")]);
  assert.match(menu,/createPortal/);assert.match(menu,/role="menu"/);assert.match(menu,/ArrowDown/);assert.match(menu,/Escape/);assert.match(menu,/pointerdown/);
  assert.doesNotMatch(detail,/<details className="signature-actions"/);assert.match(list,/SignatureActionsMenu/);
  assert.deepEqual(signatureActionPolicy({status:"completed",operationallyHidden:false,sourceAvailable:true,deletionEligible:true}).filter((item)=>["duplicate","archive","history","advanced","delete"].includes(item)),["duplicate","archive","delete","history","advanced"]);
  assert.ok(!signatureActionPolicy({status:"completed",operationallyHidden:false,sourceAvailable:true,deletionEligible:false}).includes("delete"));
  assert.match(detail,/Descargar|deletionMode/);
});

test("manual media URL controls are absent while upload-backed hidden compatibility remains",async()=>{
  const files=await Promise.all([
    source("app/admin/propiedades/nueva/page.tsx"),source("app/admin/propiedades/[id]/editar/EditarPropiedadForm.tsx"),
    source("app/admin/testimonios/nuevo/page.tsx"),source("app/admin/testimonios/[id]/editar/EditarTestimonioForm.tsx"),
  ]);
  for(const content of files){assert.doesNotMatch(content,/Añadir o editar URLs manualmente|Foto URL/);}
  assert.match(files[0],/PropertyMediaManager/);assert.match(files[1],/PropertyMediaManager/);
  assert.match(files[2],/name="foto_url" type="hidden"/);assert.match(files[3],/name="foto_url" type="hidden"/);
  assert.match(files[2],/ImagenesUploader/);assert.match(files[3],/ImagenesUploader/);
});

test("profile groups account, recovery and security with accessible password controls",async()=>{
  const profile=await source("app/admin/profile/ProfileForms.tsx");
  assert.match(profile,/Resumen de la cuenta/);assert.match(profile,/Correo y recuperación/);assert.match(profile,/Seguridad/);
  assert.match(profile,/aria-pressed/);assert.match(profile,/current-password/);assert.match(profile,/new-password/);
  assert.match(profile,/sm:grid-cols-2/);assert.match(profile,/role="alert"/);assert.match(profile,/role="status"/);
});
