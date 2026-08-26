import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { appendDrawingPoints, hasAdoptableDrawing, MAX_DRAWING_POINTS, normalizedDrawingPoint } from "../lib/signatures/drawing.ts";
import { signatureActionPolicy } from "../lib/signatures/action-policy.ts";
import { normalizeSignerCapture } from "../lib/signatures/signer/capture.ts";

const source=(file)=>readFile(path.join(process.cwd(),file),"utf8");

test("pointer coordinates remain normalized across CSS and high-DPI canvas sizes",()=>{
  assert.deepEqual(normalizedDrawingPoint(150,100,{left:50,top:50,width:200,height:100}),{x:.5,y:.5});
  assert.deepEqual(normalizedDrawingPoint(-10,999,{left:0,top:0,width:300,height:150}),{x:0,y:1});
});

test("drawings are bounded, adoptable only with complete strokes, and retain fast coalesced points",()=>{
  assert.equal(hasAdoptableDrawing([]),false);
  assert.equal(hasAdoptableDrawing([[{x:.1,y:.2}]]),false);
  const points=Array.from({length:MAX_DRAWING_POINTS+50},(_,index)=>({x:(index%100)/100,y:.5}));
  const result=appendDrawingPoints([[{x:.1,y:.2}]],points);
  assert.equal(result[0].length,MAX_DRAWING_POINTS);
  assert.equal(hasAdoptableDrawing(result),true);
});

test("drawn initials use existing vector evidence without weakening typed initials",()=>{
  const drawn=normalizeSignerCapture("initials",{method:"drawn",strokes:[[{x:.1,y:.2},{x:.8,y:.7}]]});
  const typed=normalizeSignerCapture("initials",{method:"typed",value:"CJSE",style:"allura"});
  assert.equal(drawn.captureMethod,"drawn_vector");
  assert.equal(drawn.signatureStyleId,null);
  assert.equal(typed.captureMethod,"typed");
  assert.equal(typed.signatureStyleId,"allura");
  assert.notEqual(drawn.valueSha256,typed.valueSha256);
});

test("lifecycle action policy is state-aware and deletion fails closed",()=>{
  assert.deepEqual(signatureActionPolicy({status:"draft",operationallyHidden:false,sourceAvailable:true,deletionEligible:true}),["edit","duplicate","archive","delete"]);
  const waiting=signatureActionPolicy({status:"partially_signed",operationallyHidden:false,sourceAvailable:true,deletionEligible:false});
  for(const action of ["view","resend","remind","correct","cancel","duplicate","history"])assert.ok(waiting.includes(action));
  assert.ok(!waiting.includes("archive"));
  const completed=signatureActionPolicy({status:"completed",operationallyHidden:false,sourceAvailable:true,deletionEligible:false});
  assert.ok(completed.includes("duplicate")&&completed.includes("archive")&&completed.includes("history")&&completed.includes("advanced"));
  assert.ok(!completed.includes("delete")&&!completed.includes("cancel"));
  const archived=signatureActionPolicy({status:"completed",operationallyHidden:true,sourceAvailable:true,deletionEligible:false});
  assert.ok(archived.includes("restore")&&!archived.includes("archive"));
});

test("signer and Admin UI expose drawn initials and consistent accessible actions",async()=>{
  const [form,canvas,detail,directory,actions]=await Promise.all([
    source("app/firmar/sesion/SignerFieldForm.tsx"),source("components/signatures/DrawnMarkCanvas.tsx"),source("app/admin/signatures/[id]/page.tsx"),source("app/admin/signatures/page.tsx"),source("components/admin/signatures/SignatureDocumentActions.tsx"),
  ]);
  assert.match(form,/signatureLike && \(/);
  assert.match(form,/Adoptar iniciales dibujadas/);
  assert.match(form,/hasAdoptableDrawing/);
  assert.match(canvas,/getCoalescedEvents/);
  assert.match(canvas,/devicePixelRatio/);
  assert.match(canvas,/ResizeObserver/);
  assert.match(canvas,/quadraticCurveTo/);
  assert.match(detail,/Descargar documento firmado/);
  assert.match(detail,/Descargar certificado/);
  assert.match(directory,/Acciones/);
  assert.match(actions,/Restaurar/);
  assert.match(actions,/Eliminar definitivamente/);
});
