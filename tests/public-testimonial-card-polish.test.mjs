import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageUrl = new URL(
  "../app/(public)/testimonios/TestimoniosClientPage.tsx",
  import.meta.url,
);

test("public testimonial cards keep the established design while using a compact responsive layout", async () => {
  const source = await readFile(pageUrl, "utf8");

  assert.match(source, /relative h-\[168px\] w-full bg-\[#f5f5f5\] sm:h-\[184px\]/);
  assert.match(source, /flex flex-1 flex-col px-5 py-4 sm:p-5/);
  assert.match(source, /mt-2\.5 text-base leading-7 text-\[#4d4d4d\]/);
  assert.match(source, /grid gap-6 lg:grid-cols-2 xl:grid-cols-3/);
  assert.match(source, /mt-auto pt-4/);
  assert.match(source, /item\.destacado \? "line-clamp-5" : "line-clamp-3"/);

  assert.match(source, /rounded-\[2rem\]/);
  assert.match(source, /border-\[#e8e8e8\]/);
  assert.match(source, /bg-white shadow-sm/);
  assert.match(source, /initialClampClass/);
  assert.match(source, /aria-expanded=\{expanded\}/);
});
