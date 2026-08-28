import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = (name) => readFile(path.join(root, name), "utf8");

test("lead directory uses a compact operational layout with accessible actions", async () => {
  const [page, menu, css] = await Promise.all([
    source("app/admin/leads/page.tsx"),
    source("components/admin/AdminActionsMenu.tsx"),
    source("app/globals.css"),
  ]);

  assert.match(page, /lead-directory-summary/);
  assert.match(page, /lead-directory-row/);
  assert.match(page, /lead-directory-actions/);
  assert.match(page, /AdminActionsMenu compact/);
  assert.match(page, /Acciones de \$\{title\}/);
  assert.match(page, /Última actividad/);
  assert.match(page, /Seguimiento/);
  assert.match(page, /item\.sourceCount === 1 \? "interacción" : "interacciones"/);
  assert.doesNotMatch(page, /interacciónes/);
  assert.match(menu, /role="menu"/);
  assert.match(menu, /ArrowDown/);
  assert.match(menu, /Escape/);
  assert.match(css, /\.lead-directory-row/);
  assert.match(css, /@media \(max-width: 639px\)[\s\S]*\.lead-directory-row/);
});

test("lead detail keeps contact, status, notes, and follow-up directly available", async () => {
  const page = await source("app/admin/leads/[id]/page.tsx");

  assert.match(page, /lead-detail-overview/);
  assert.match(page, /Acciones de contacto/);
  assert.match(page, /CopyLeadValueButton/);
  assert.match(page, /Controles CRM/);
  assert.match(page, /Notas internas/);
  assert.match(page, /Cronología/);
  assert.doesNotMatch(page, /<details|<summary/);
});
