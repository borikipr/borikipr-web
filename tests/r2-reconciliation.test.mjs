import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyR2Objects,
  redactR2Identifier,
} from "../lib/r2-reconciliation-policy.ts";
import {
  isSafePublicMediaObjectKey,
  isSafePrivateObjectKey,
} from "../lib/r2.ts";

const now = new Date("2026-07-28T12:00:00.000Z");
const old = new Date("2026-07-01T12:00:00.000Z");
const recent = new Date("2026-07-27T12:00:00.000Z");

test("reconciliation classifies references, delayed media, and financial exclusions", () => {
  const result = classifyR2Objects({
    now,
    publicReferences: new Set(["propiedades/kept.jpg"]),
    financialReferences: new Set(["lead-documents/kept/document.pdf"]),
    objects: [
      { key: "propiedades/kept.jpg", size: 10, lastModified: old },
      { key: "propiedades/orphan.jpg", size: 10, lastModified: old },
      { key: "testimonios/recent.jpg", size: 10, lastModified: recent },
      { key: "lead-documents/orphan/document.pdf", size: 10, lastModified: old },
      {
        key: "lead-documents/kept/document.pdf",
        size: 10,
        lastModified: old,
      },
    ],
  });
  assert.deepEqual(
    result.eligiblePublicMedia.map((item) => item.key),
    ["propiedades/orphan.jpg"]
  );
  assert.equal(result.orphanTestimonialMedia.length, 1);
  assert.equal(result.financialOrphansExcluded.length, 1);
});

test("public deletion safety cannot target financial or malformed keys", () => {
  assert.equal(isSafePublicMediaObjectKey("propiedades/a.jpg"), true);
  assert.equal(isSafePublicMediaObjectKey("testimonios/a.jpg"), true);
  assert.equal(
    isSafePublicMediaObjectKey("lead-documents/person/document.pdf"),
    false
  );
  assert.equal(isSafePublicMediaObjectKey("../propiedades/a.jpg"), false);
  assert.equal(isSafePrivateObjectKey("lead-documents/a/file.pdf"), true);
});

test("reconciliation output identifiers are deterministic and redacted", () => {
  const redacted = redactR2Identifier("propiedades/private-name.jpg");
  assert.match(redacted, /^[a-f0-9]{12}$/);
  assert.equal(redacted, redactR2Identifier("propiedades/private-name.jpg"));
  assert.ok(!redacted.includes("private-name"));
});
