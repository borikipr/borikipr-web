import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { haveSameOrderedPropertyImages } from "../lib/admin/property-edit.ts";

const root = process.cwd();

test("property edit preserves legacy non-object form configuration without enumerating it", async () => {
  const [action, query] = await Promise.all([
    readFile(path.join(root, "app/admin/propiedades/actions.ts"), "utf8"),
    readFile(path.join(root, "lib/admin/queries.ts"), "utf8"),
  ]);

  assert.doesNotMatch(action, /\.\.\.\(propiedadActual\.configuracion_formulario/);
  assert.match(action, /WHEN jsonb_typeof\(configuracion_formulario\) = 'object'/);
  assert.match(action, /ELSE configuracion_formulario/);
  assert.match(query, /WHEN jsonb_typeof\(p\.configuracion_formulario\) = 'object'[\s\S]*ELSE NULL/);
});

test("description-only property edits do not rewrite unchanged ordered images", () => {
  const images = Array.from({ length: 12 }, (_, index) => `https://images.example.test/${index + 1}.jpg`);

  assert.equal(haveSameOrderedPropertyImages(images, [...images]), true);
  assert.equal(haveSameOrderedPropertyImages(images, [...images].reverse()), false);
  assert.equal(haveSameOrderedPropertyImages(images, images.slice(0, -1)), false);
});
