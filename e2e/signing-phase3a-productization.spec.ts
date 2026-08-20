import { expect,test,type Page } from "@playwright/test";
import { mkdir,writeFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument,StandardFonts } from "pdf-lib";

const enabled=process.env.E2E_SIGNING_ADMIN_QA==="1";
const fixture=path.resolve("tmp/signatures/phase3a-productization.pdf");
const artifacts=path.resolve("tmp/admin-ux-artifacts/phase3a");

async function login(page:Page){
  await page.goto("/admin/login");
  await page.getByLabel("Usuario").fill(process.env.E2E_ADMIN_USERNAME||"synthetic-signing-admin");
  await page.getByLabel(/Contrase/).fill(process.env.E2E_SIGNING_ADMIN_PASSWORD||"");
  await Promise.all([page.waitForURL((url)=>url.pathname==="/admin",{timeout:60_000}),page.getByRole("button",{name:"Entrar"}).click()]);
}

async function configureBroker(page:Page){
  await page.goto("/admin/signatures/configuracion");
  if(await page.getByText(/Configurada:/).count())return;
  await page.getByLabel("Cuenta Admin de Ivonne").selectOption({label:"Synthetic Signing Admin"});
  await page.getByLabel(/Escribe CONFIGURAR CORREDORA FINAL/).fill("CONFIGURAR CORREDORA FINAL");
  await page.getByRole("button",{name:"Guardar corredora final"}).click();
  await expect(page.getByText(/Configurada:/)).toBeVisible();
}

async function createDraft(page:Page,title:string){
  await page.goto("/admin/signatures/nuevo");
  await page.getByLabel(/T.tulo interno/).fill(title);
  await page.getByLabel(/Tipo de documento/).selectOption("ordinary_brokerage_agreement");
  await page.getByLabel("Forma de firma").selectOption("grouped");
  await page.getByLabel(/Fecha de expiraci.n/).fill("2026-09-30");
  await page.getByRole("checkbox",{name:/Requiere firma de la corredora/}).check();
  await page.getByLabel(/PDF fuente/).setInputFiles(fixture);
  const [response]=await Promise.all([
    page.waitForResponse((item)=>item.url().endsWith("/api/admin/signatures/drafts")&&item.request().method()==="POST",{timeout:120_000}),
    page.getByRole("button",{name:"Guardar y continuar"}).click(),
  ]);
  expect(response.status()).toBe(201);
  const created=await response.json() as {documentId:string};
  await page.goto(`/admin/signatures/${created.documentId}`,{waitUntil:"domcontentloaded"});
  await expect(page).toHaveURL(new RegExp(`/admin/signatures/${created.documentId}$`));
  return created.documentId;
}

async function addRecipient(page:Page,input:{name:string;email:string;role:string;group:string}){
  const form=page.locator("form").filter({has:page.getByRole("button",{name:"Añadir destinatario"})});
  await form.getByLabel("Nombre").fill(input.name);await form.getByLabel("Correo").fill(input.email);
  await form.getByLabel("Rol").fill(input.role);await form.getByLabel("Grupo de firma").fill(input.group);
  await form.getByRole("button",{name:"Añadir destinatario"}).click();
  await expect(page.getByText(input.email,{exact:true})).toBeVisible({timeout:60_000});
}

test.describe("Phase 3A Borikí Sign product workflow",()=>{
  test.skip(!enabled,"Requires the disposable isolated signing Admin runtime.");
  test.describe.configure({mode:"serial",timeout:600_000});
  test.beforeAll(async()=>{
    const pdf=await PDFDocument.create();const font=await pdf.embedFont(StandardFonts.Helvetica);
    for(let index=0;index<2;index++){const page=pdf.addPage([612,792]);page.drawText(`BORIKI SIGN PHASE 3A SYNTHETIC PAGE ${index+1}`,{x:54,y:730,size:14,font});}
    await mkdir(path.dirname(fixture),{recursive:true});await mkdir(artifacts,{recursive:true});
    await writeFile(fixture,await pdf.save({useObjectStreams:false}));
  });
  test.beforeEach(async({page})=>login(page));

  test("desktop prepares grouped routing, broker final fields, template and identity-free reuse",async({page},testInfo)=>{
    test.skip(testInfo.project.name!=="desktop-chromium","Desktop workflow runs once.");
    await configureBroker(page);const title=`TEST Phase 3A product workflow ${testInfo.retry}`;await createDraft(page,title);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button",{name:"Destinatarios",exact:true}).click();
    await expect(page.getByRole("heading",{name:"2. Destinatarios"})).toBeVisible();
    await expect(page.getByText("Corredora · Firma final")).toBeVisible();
    await expect(page.getByRole("button",{name:"Eliminar destinatario"})).toHaveCount(0);
    await addRecipient(page,{name:"Parte Compradora Sintética",email:"phase3a-buyer@example.test",role:"Parte Compradora",group:"1"});
    await addRecipient(page,{name:"Parte Vendedora Sintética",email:"phase3a-seller@example.test",role:"Parte Vendedora",group:"2"});
    await page.getByRole("button",{name:"Campos",exact:true}).click();
    const owner=page.getByLabel("Asignar a");
    await owner.selectOption({label:"Parte Compradora Sintética"});await page.getByRole("button",{name:"+ Firma"}).click();
    await owner.selectOption({label:"Parte Vendedora Sintética"});await page.getByRole("button",{name:"+ Texto"}).click();
    await owner.selectOption({label:"Synthetic Signing Admin"});await page.getByRole("button",{name:"+ Firma"}).click();await page.getByRole("button",{name:"+ Fecha de firma"}).click();
    await page.screenshot({fullPage:true,path:path.join(artifacts,"phase3a-editor-desktop.png")});
    const template=page.getByText("Guardar como plantilla",{exact:true});await template.click();
    const templateForm=template.locator("..");await templateForm.getByLabel("Nombre de plantilla").fill("Plantilla Phase 3A sintética");
    await templateForm.getByRole("button",{name:"Guardar plantilla"}).click();await expect(page.getByText(/Plantilla guardada/)).toBeVisible();
    await page.goto("/admin/signatures/plantillas");await expect(page.getByText("Plantilla Phase 3A sintética",{exact:true}).first()).toBeVisible();
    await page.getByRole("link",{name:"Usar plantilla"}).first().click();
    await expect(page.getByText(/no reutiliza personas, firmas ni accesos/)).toBeVisible();
    await expect(page.getByText("phase3a-buyer@example.test")).toHaveCount(0);
    await page.screenshot({fullPage:true,path:path.join(artifacts,"phase3a-template-use-desktop.png")});
    await page.getByLabel("Expira").fill("2026-09-30");
    const names=page.locator('input[name^="name:"]');const emails=page.locator('input[name^="email:"]');
    await names.nth(0).fill("Nueva Parte Compradora");await emails.nth(0).fill("phase3a-new-buyer@example.test");
    await names.nth(1).fill("Nueva Parte Vendedora");await emails.nth(1).fill("phase3a-new-seller@example.test");
    await page.getByRole("button",{name:"Crear solicitud desde plantilla"}).click();
    await page.waitForURL(/\/admin\/signatures\/[0-9a-f-]+$/,{timeout:120_000});await page.waitForLoadState("networkidle");
    await page.getByRole("button",{name:"Destinatarios",exact:true}).click();
    await expect(page.getByText("Nueva Parte Compradora",{exact:true})).toBeVisible();await expect(page.getByText("Corredora · Firma final")).toBeVisible();
    await page.getByText("Más acciones",{exact:true}).click();
    await expect(page.getByRole("button",{name:"Duplicar solicitud"})).toBeVisible();
    await expect(page.getByText(/Cancelar solicitud/)).toHaveCount(0);
  });

  test("mobile signing home, setup, wizard and template surfaces remain intentional",async({page},testInfo)=>{
    test.skip(testInfo.project.name!=="mobile-chromium","Mobile workflow runs once.");
    for(const width of [360,390,412]){
      await page.setViewportSize({width,height:915});await page.goto("/admin/signatures");
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
      await expect(page.getByRole("link",{name:"Nuevo documento"}).first()).toBeVisible();
      await page.goto("/admin/signatures/nuevo");await expect(page.getByRole("link",{name:/Usar plantilla/})).toBeVisible();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBe(0);
      if(width===390)await page.screenshot({fullPage:true,path:path.join(artifacts,"phase3a-new-request-mobile.png")});
    }
  });
});
