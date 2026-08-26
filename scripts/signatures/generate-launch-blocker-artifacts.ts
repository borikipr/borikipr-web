import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDetachedCertificate } from "../../lib/signatures/signer/finalize";
import { finalizePrototypePdf } from "../../lib/signatures/prototype/finalize";
import { inspectPdfCompatibility } from "../../lib/signatures/prototype/inspect";
import { renderPdfWithPdfJs } from "../../lib/signatures/prototype/render";

async function main() {
  const root = process.cwd();
  const output = path.join(root, "tmp", "pdfs", "launch-blocker-remediation");
  const sourceBytes = new Uint8Array(
    await readFile(
      path.join(
        root,
        "tests",
        "fixtures",
        "signatures",
        "representative",
        "HOJA DE OFERTA - con logo.pdf",
      ),
    ),
  );
  const inspection = await inspectPdfCompatibility({
    bytes: sourceBytes,
    mimeType: "application/pdf",
    limits: { maximumSourceBytes: 3_000_000, maximumPages: 25 },
  });
  const participant = {
    id: "cedric",
    displayName: "Cedric Santiago",
    role: "Comprador 1",
    completedAt: "2026-08-25T23:20:00.000Z",
  };
  const finalized = await finalizePrototypePdf({
    sourceBytes,
    sourceTitle: "CANARY FINAL 0038 - HOJA DE OFERTA - SIN VALOR COMERCIAL",
    sourceSha256: inspection.sourceSha256,
    geometries: inspection.pages,
    fields: [
      {
        id: "canary-0038-date-signed",
        participantId: participant.id,
        type: "date_signed",
        pageIndex: 0,
        rect: { x: 0.42, y: 0.62, width: 0.30, height: 0.07 },
        value: { method: "date", value: "2026-08-25" },
      },
    ],
    participants: [participant],
    requestId: "isolated-launch-blocker-fixture",
    verificationId: "isolated-launch-blocker-verification",
    consentVersion: "isolated-es-pr",
    completedAt: "2026-08-25T23:33:03.000Z",
  });
  const certificate = await createDetachedCertificate({
    title: "CANARY FINAL 0038 - HOJA DE OFERTA - SIN VALOR COMERCIAL",
    documentId: "isolated-launch-blocker-fixture",
    sourceSha256: inspection.sourceSha256,
    finalSha256: finalized.manifest.finalPdfSha256,
    fieldDefinitionSha256: finalized.fieldDefinitionSha256,
    verificationId: "isolated-launch-blocker-verification",
    senderOperator: "Administrador de prueba",
    participants: [
      { ...participant, routingOrder: 1, finalSigner: false },
      {
        id: "ivonne",
        displayName: "Ivonne Erickson",
        role: "Corredora · Firma final",
        routingOrder: 8,
        finalSigner: true,
        completedAt: "2026-08-25T23:33:03.000Z",
      },
    ],
    completedAt: "2026-08-25T23:33:03.000Z",
    consentVersion: "isolated-es-pr",
    privacyDisclosureVersion: "isolated-bilingual",
    privacyDisclosureEsPrSha256: "d".repeat(64),
    privacyDisclosureEnUsSha256: "e".repeat(64),
  });
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(path.join(output, "date-signed-corrected.pdf"), finalized.finalBytes),
    writeFile(path.join(output, "certificate-routing-corrected.pdf"), certificate),
  ]);
  const [finalPages, certificatePages] = await Promise.all([
    renderPdfWithPdfJs(finalized.finalBytes, 1.6),
    renderPdfWithPdfJs(certificate, 1.6),
  ]);
  await Promise.all([
    ...finalPages.map((page) =>
      writeFile(
        path.join(output, `date-signed-corrected-page-${page.pageIndex + 1}.png`),
        page.pngBytes,
      ),
    ),
    ...certificatePages.map((page) =>
      writeFile(
        path.join(output, `certificate-routing-corrected-page-${page.pageIndex + 1}.png`),
        page.pngBytes,
      ),
    ),
  ]);
  console.log(output);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
