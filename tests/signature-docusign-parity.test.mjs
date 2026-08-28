import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { evaluateSignatureVisualPreflight } from "../lib/signatures/visual-preflight.ts";
import { buildSignatureRoutingStages, signatureRoutingModeLabel } from "../lib/signatures/routing-ux.ts";
import { signatureOperationalStatus, signatureRequiresAttention } from "../lib/signatures/admin-ux.ts";
import { formatPuertoRicoDate, formatPuertoRicoDateTime } from "../lib/puerto-rico-time.ts";

const root=process.cwd();
const source=(file)=>readFile(path.join(root,file),"utf8");
const field=(overrides={})=>({id:"field-1",fieldType:"text",pageIndex:0,normalizedX:.1,normalizedY:.1,normalizedWidth:.25,normalizedHeight:.06,label:"Texto",...overrides});

test("visual preflight blocks overlaps, clipping and undersized signature fields",()=>{
  const result=evaluateSignatureVisualPreflight([
    field(),
    field({id:"field-2",fieldType:"signature",label:"Firma",normalizedX:.2,normalizedY:.12,normalizedWidth:.12,normalizedHeight:.03}),
    field({id:"field-3",fieldType:"date_signed",label:"Fecha de firma",normalizedX:.92,normalizedY:.9,normalizedWidth:.14,normalizedHeight:.04}),
    field({id:"field-4",label:"Texto fuera",normalizedX:1.05,normalizedY:.4,normalizedWidth:.2,normalizedHeight:.05}),
  ]);
  assert.equal(result.sendBlocked,true);
  assert.ok(result.issues.some((issue)=>issue.code==="field_overlap"));
  assert.ok(result.issues.some((issue)=>issue.code==="field_too_small"&&issue.fieldIds.includes("field-2")));
  assert.ok(result.issues.some((issue)=>issue.code==="partially_outside_page"&&issue.fieldIds.includes("field-3")));
  assert.ok(result.issues.some((issue)=>issue.code==="outside_page"&&issue.fieldIds.includes("field-4")));
});

test("visual preflight allows intentional separated fields and treats a near margin as warning",()=>{
  const result=evaluateSignatureVisualPreflight([
    field({id:"signature",fieldType:"signature",normalizedX:.05,normalizedY:.2,normalizedWidth:.3,normalizedHeight:.08}),
    field({id:"date",fieldType:"date_signed",normalizedX:.7,normalizedY:.2,normalizedWidth:.18,normalizedHeight:.05}),
    field({id:"margin",normalizedX:.005,normalizedY:.8,normalizedWidth:.2,normalizedHeight:.05}),
  ]);
  assert.equal(result.sendBlocked,false);
  assert.equal(result.warningCount,1);
  assert.equal(result.issues[0].code,"margin_position");
});

test("Date Signed preflight uses the final-render sizing model",()=>{
  const geometry={pageIndex:0,mediaBox:{x:0,y:0,width:612,height:792},cropBox:{x:0,y:0,width:612,height:792},rotation:0,userUnit:1};
  const canary=evaluateSignatureVisualPreflight([
    field({id:"canary-date",fieldType:"date_signed",normalizedX:.42,normalizedY:.62,normalizedWidth:.30,normalizedHeight:.07}),
  ],[geometry]);
  assert.equal(canary.sendBlocked,false);
  const compactGeometry={...geometry,mediaBox:{x:0,y:0,width:200,height:200},cropBox:{x:0,y:0,width:200,height:200}};
  const tooNarrow=evaluateSignatureVisualPreflight([
    field({id:"narrow-date",fieldType:"date_signed",normalizedX:.42,normalizedY:.62,normalizedWidth:.14,normalizedHeight:.04}),
  ],[compactGeometry]);
  assert.equal(tooNarrow.sendBlocked,true);
  assert.ok(tooNarrow.issues.some((issue)=>issue.id==="date-fit:narrow-date"&&issue.code==="field_too_small"));
});

test("routing summary preserves grouped stages and the configured broker as the final stage",()=>{
  const participants=[
    {id:"buyer",name:"Cedric",role:"Comprador",routingOrder:1,isBrokerFinalSigner:false},
    {id:"seller",name:"Vendedor",role:"Vendedor",routingOrder:1,isBrokerFinalSigner:false},
    {id:"broker",name:"Ivonne",role:"Corredora",routingOrder:2,isBrokerFinalSigner:true},
  ];
  const stages=buildSignatureRoutingStages(participants,"grouped");
  assert.equal(signatureRoutingModeLabel("parallel"),"Firmar al mismo tiempo");
  assert.equal(stages.length,2);
  assert.deepEqual(stages[0].participants.map((item)=>item.id),["buyer","seller"]);
  assert.equal(stages[1].participants[0].isBrokerFinalSigner,true);
});

test("waiting language is operational and ordinary waiting does not require attention",()=>{
  const participants=[{name:"Ivonne",role:"Corredora",routingOrder:2,status:"invited",isBrokerFinalSigner:true}];
  assert.equal(signatureOperationalStatus({status:"partially_signed",participants}),"Esperando la firma de la corredora");
  assert.equal(signatureRequiresAttention({status:"partially_signed",deliveryStatus:"delivered"}),false);
  assert.equal(signatureRequiresAttention({status:"sent",deliveryStatus:"failed"}),true);
  assert.equal(signatureRequiresAttention({status:"expired"}),true);
});

test("authenticated signing dates hydrate deterministically across server and browser time zones",()=>{
  const originalTimeZone=process.env.TZ;
  try {
    process.env.TZ="UTC";
    const server={date:formatPuertoRicoDate("2026-08-27T03:59:59.000Z"),dateTime:formatPuertoRicoDateTime("2026-08-25T23:33:03.000Z")};
    process.env.TZ="Asia/Tokyo";
    const browser={date:formatPuertoRicoDate("2026-08-27T03:59:59.000Z"),dateTime:formatPuertoRicoDateTime("2026-08-25T23:33:03.000Z")};
    assert.deepEqual(browser,server);
    assert.equal(server.date,"08/26/2026");
    assert.match(server.dateTime,/08\/25\/2026/);
  } finally {
    process.env.TZ=originalTimeZone;
  }
});

test("sender and signer surfaces expose parity UX without changing security semantics",async()=>{
  const [editor,routing,detail,session,completed,landing,exchange,actions,templates,styles]=await Promise.all([
    source("components/admin/signatures/SignatureDraftEditor.tsx"),
    source("components/admin/signatures/SignatureRoutingSummary.tsx"),
    source("app/admin/signatures/[id]/page.tsx"),
    source("app/firmar/sesion/page.tsx"),
    source("app/firmar/completado/page.tsx"),
    source("components/signatures/SignerInvitationLanding.tsx"),
    source("app/api/signatures/session/exchange/route.ts"),
    source("components/admin/signatures/SignatureDocumentActions.tsx"),
    source("app/admin/signatures/plantillas/page.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(editor,/Todo listo para enviar/);
  assert.match(editor,/visualPreflight\.sendBlocked/);
  assert.match(editor,/SignatureRoutingSummary/);
  assert.match(editor,/signature-editor-application-bar/);
  assert.match(editor,/Campos para/);
  assert.match(editor,/signature-mobile-properties-backdrop/);
  assert.doesNotMatch(editor,/toLocale(?:DateString|String)\(\"es-PR\"/);
  assert.match(routing,/Ruta de firmas/);
  assert.match(editor,/Reenviar invitación/);
  assert.match(editor,/Un recordatorio conserva el acceso actual/);
  assert.match(detail,/Requiere atención/);
  assert.match(detail,/Detalles avanzados/);
  assert.match(detail,/detail\.status !== "completed" \? \(/);
  assert.match(detail,/signature-completed-header/);
  assert.match(session,/SignerRequiredFieldNavigator/);
  assert.match(completed,/Tu participación fue completada/);
  assert.match(completed,/El documento ha sido completado/);
  assert.match(landing,/Esta invitación fue reemplazada/);
  assert.match(exchange,/inspectSigningTokenUnavailableReason/);
  assert.match(actions,/conserva su evidencia/);
  assert.match(templates,/signature-template-grid/);
  assert.match(styles,/signature-field-editor-layout/);
  assert.match(styles,/signature-adoption-dialog/);
  assert.match(styles,/grid-template-areas:\s*"application application application"/);
  assert.match(styles,/\.signature-field-properties\.has-selection/);
  assert.match(styles,/\.signature-lifecycle-mobile-menu/);
  assert.match(styles,/\.signature-directory-toolbar\s*\{[\s\S]*?max-width:\s*100%/);
  assert.match(styles,/\.signature-lifecycle-tabs\s*\{[\s\S]*?min-w-0/);
});

test("send mutation rechecks visual geometry server-side",async()=>{
  const actions=await source("app/admin/signatures/actions.ts");
  assert.match(actions,/evaluateSignatureVisualPreflight\([\s\S]*authorizationDetail\.fields,[\s\S]*authorizationDetail\.version\.pageGeometry/);
  assert.match(actions,/visualPreflight\.sendBlocked/);
  assert.match(actions,/Corrige la colocación de campos antes de enviar/);
});
