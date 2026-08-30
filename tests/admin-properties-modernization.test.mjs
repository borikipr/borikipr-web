import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = (name) => readFile(path.join(root, name), "utf8");

test("property inventory is compact, filterable, and does not add N+1 media reads", async () => {
  const [page, queries] = await Promise.all([
    source("app/admin/propiedades/page.tsx"),
    source("lib/admin/queries.ts"),
  ]);

  for (const field of ['name="q"', 'name="estado"', 'name="tipo"', 'name="destacado"']) {
    assert.match(page, new RegExp(field));
  }
  assert.match(page, /property-inventory-row/);
  assert.match(page, /cover_image_url/);
  assert.match(page, /Nueva propiedad/);
  assert.doesNotMatch(page, /<table/);
  assert.match(queries, /SELECT pi\.url[\s\S]*ORDER BY pi\.orden ASC[\s\S]*LIMIT 1/);
  assert.match(queries, /cover_image_url/);
});

test("property actions use a portal menu and deliberate destructive dialog", async () => {
  const [menu, actions] = await Promise.all([
    source("components/admin/AdminActionsMenu.tsx"),
    source("app/admin/propiedades/PropiedadRowActions.tsx"),
  ]);

  assert.match(menu, /createPortal/);
  assert.match(menu, /role="menu"/);
  assert.match(menu, /ArrowDown/);
  assert.match(menu, /Escape/);
  assert.match(menu, /pointerdown/);
  assert.match(actions, /AdminActionDialog/);
  assert.match(actions, /Eliminar propiedad/);
  assert.match(actions, /Ver en sitio/);
  assert.match(actions, /Enlace privado de visita/);
  assert.doesNotMatch(actions, /window\.confirm/);
});

test("property editor groups the existing schema without changing submit behavior", async () => {
  const [createPage, editForm, editPage] = await Promise.all([
    source("app/admin/propiedades/nueva/NuevaPropiedadForm.tsx"),
    source("app/admin/propiedades/[id]/editar/EditarPropiedadForm.tsx"),
    source("app/admin/propiedades/[id]/editar/page.tsx"),
  ]);

  for (const content of [createPage, editForm]) {
    for (const label of ["Información principal", "Características", "Publicación y operación", "Descripción", "Multimedia"]) {
      assert.match(content, new RegExp(label));
    }
    assert.match(content, /property-save-bar/);
    assert.match(content, /PropertyMediaManager/);
    assert.doesNotMatch(content, /Añadir o editar URLs manualmente/);
  }
  assert.match(editPage, /Ver en sitio/);
  assert.match(editPage, /AdminPageHeader/);
});

test("media management preserves drag, cover, reorder fallback, and legacy rendering", async () => {
  const [manager, dropZone, css] = await Promise.all([
    source("app/admin/propiedades/PropertyMediaManager.tsx"),
    source("components/admin/MediaDropZone.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(manager, /draggable/);
  assert.match(manager, /Portada/);
  assert.match(manager, /Mover imagen antes/);
  assert.match(manager, /Mover imagen después/);
  assert.match(manager, /Usar como portada/);
  assert.match(manager, /src=\{url\}/);
  assert.match(dropZone, /Arrastra imágenes o videos aquí/);
  assert.match(dropZone, /Seleccionar \{multiple \? "archivos" : "archivo"\}/);
  assert.doesNotMatch(dropZone, /Añadir o editar URLs manualmente|URL manual/i);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*\.property-media-grid[\s\S]*grid-cols-2/);
  assert.match(css, /\.property-inventory-row/);
});
