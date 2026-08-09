import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "pdf-lib";
import { runSyntheticMaximumPdfDrill } from "../lib/signatures/prototype/maximum-drill.ts";
import { sha256Hex } from "../lib/signatures/prototype/hash.ts";

test("maximum 25-page, 8-participant, 100-field PDF finalizes within MVP limits", async () => {
  const result = await runSyntheticMaximumPdfDrill();
  assert.equal(result.metrics.pages, 25);
  assert.equal(result.metrics.participants, 8);
  assert.equal(result.metrics.fields, 100);
  assert.ok(result.metrics.sourceBytes < 3_000_000);
  assert.ok(result.metrics.finalBytes < 4_000_000);
  assert.ok(result.metrics.finalizationMs < 30_000);
  assert.notEqual(sha256Hex(result.sourceBytes), sha256Hex(result.finalBytes));
  assert.equal(result.manifest.participants.length, 8);
  assert.equal(result.manifest.fieldCaptures.length, 100);
  const finalPdf = await PDFDocument.load(result.finalBytes);
  assert.equal(finalPdf.getPageCount(), 26);
  console.log(`synthetic_max_pdf_metrics=${JSON.stringify(result.metrics)}`);
});
