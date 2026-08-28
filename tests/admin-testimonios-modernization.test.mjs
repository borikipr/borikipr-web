import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("testimonial directory presents a compact operational list with clear publication state", async () => {
  const source = await read("app/admin/testimonios/page.tsx");
  assert.match(source, /testimonial-directory-row/);
  assert.match(source, /Publicado/);
  assert.match(source, /Oculto/);
  assert.match(source, /Nuevo testimonio/);
  assert.match(source, /testimonial-summary-grid/);
});

test("testimonial actions use the shared accessible menu and deliberate delete dialog", async () => {
  const source = await read("app/admin/testimonios/TestimonioRowActions.tsx");
  assert.match(source, /AdminActionsMenu/);
  assert.match(source, /AdminActionDialog/);
  assert.match(source, /Eliminar testimonio/);
  assert.match(source, /Publicar en el website/);
  assert.match(source, /Ocultar del website/);
});

test("create and edit forms keep image, publication, and keyboard labels in one coherent workflow", async () => {
  const [createSource, editSource] = await Promise.all([
    read("app/admin/testimonios/nuevo/page.tsx"),
    read("app/admin/testimonios/[id]/editar/EditarTestimonioForm.tsx"),
  ]);
  for (const source of [createSource, editSource]) {
    assert.match(source, /testimonial-editor-form/);
    assert.match(source, /Información principal/);
    assert.match(source, /Imagen/);
    assert.match(source, /Publicación/);
    assert.match(source, /aria-pressed/);
    assert.match(source, /aria-label="Quitar imagen"/);
  }
});

test("testimonial translation keeps daily workflow visible without exposing audit history", async () => {
  const source = await read("app/admin/testimonios/[id]/editar/page.tsx");
  assert.match(source, /TranslationAdminPanel fields=\{translationFields\} showHistory=\{false\}/);
});

test("responsive testimonial styles use compact mobile layout without page-level horizontal flow", async () => {
  const source = await read("app/globals.css");
  assert.match(source, /\.testimonial-directory-row/);
  assert.match(source, /@media \(max-width: 639px\)/);
  assert.match(source, /grid-template-columns: minmax\(0, 1fr\) auto/);
});
