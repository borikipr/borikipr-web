import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const { getPaginationItems } = await import("../lib/admin/pagination.ts");

test("lead pagination provides direct numeric targets with compact ellipses", () => {
  assert.deepEqual(getPaginationItems(1, 1), [1]);
  assert.deepEqual(getPaginationItems(3, 6), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(getPaginationItems(5, 18), [1, "ellipsis-left", 4, 5, 6, "ellipsis-right", 18]);
});

test("lead pagination preserves the current filter URL builder and accessible semantics", async () => {
  const [page, component] = await Promise.all([read("app/admin/leads/page.tsx"), read("components/admin/LeadsPagination.tsx")]);
  assert.match(page, /hrefForPage=\{\(page\) => directoryHref\(filters, page\)\}/);
  assert.match(component, /aria-label="Paginación de leads"/);
  assert.match(component, /aria-current="page"/);
  assert.match(component, /aria-disabled="true"/);
});

test("analytics overview associates all provider names with local supplemental logos", async () => {
  const source = await read("app/admin/analytics/page.tsx");
  for (const provider of ["google-analytics.svg", "microsoft-clarity.svg", "vercel-analytics.svg"]) {
    assert.match(source, new RegExp(provider));
  }
  assert.match(source, /alt="" aria-hidden="true"/);
  assert.match(source, /Ver GA4/);
  assert.match(source, /Ver Clarity/);
  assert.match(source, /Ver Vercel/);
});
