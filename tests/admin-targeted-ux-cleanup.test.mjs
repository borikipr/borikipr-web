import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { signatureActionPolicy } from "../lib/signatures/action-policy.ts";

const root=path.dirname(fileURLToPath(new URL("../package.json",import.meta.url)));
const source=(name)=>readFile(path.join(root,name),"utf8");

test("Signing actions use one canonical eligibility result in list and detail",async()=>{
  const [menu,actions,list,detailPage,styles]=await Promise.all([source("components/admin/signatures/SignatureActionsMenu.tsx"),source("components/admin/signatures/SignatureDocumentActions.tsx"),source("app/admin/signatures/page.tsx"),source("app/admin/signatures/[id]/page.tsx"),source("app/globals.css")]);
  assert.match(menu,/createPortal/);assert.match(menu,/role="menu"/);assert.match(menu,/ArrowDown/);assert.match(menu,/Escape/);assert.match(menu,/pointerdown/);
  assert.match(menu,/below \+ menuHeight > window\.innerHeight/);assert.match(styles,/max-height: calc\(100vh - 24px\)/);
  assert.doesNotMatch(actions,/<details className="signature-actions"/);
  assert.match(list,/inspectSignatureDeletionEligibility/);assert.match(list,/SignatureDocumentActions/);
  assert.match(detailPage,/inspectSignatureDeletionEligibility/);assert.doesNotMatch(list,/deletionEligible: false/);
  assert.match(actions,/detailHref/);assert.match(list,/detailHref=\{`\/admin\/signatures\/\$\{row\.id\}`\}/);
  assert.match(actions,/disabled=\{!actions\.has\("delete"\)\}/);
  assert.match(actions,/No se puede eliminar porque contiene evidencia o una dependencia protegida\./);
  assert.match(styles,/\.signature-actions-item:disabled/);
  assert.deepEqual(signatureActionPolicy({status:"completed",operationallyHidden:false,sourceAvailable:true,deletionEligible:true}).filter((item)=>["duplicate","archive","history","advanced","delete"].includes(item)),["duplicate","archive","delete","history","advanced"]);
  assert.ok(!signatureActionPolicy({status:"completed",operationallyHidden:false,sourceAvailable:true,deletionEligible:false}).includes("delete"));
  for(const status of ["draft","sent","viewed","partially_signed","completed","voided","expired","archived"]){assert.ok(signatureActionPolicy({status,operationallyHidden:status==="archived",sourceAvailable:true,deletionEligible:true}).includes("delete"),status);}
  assert.match(actions,/Descargar|deletionMode/);
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
