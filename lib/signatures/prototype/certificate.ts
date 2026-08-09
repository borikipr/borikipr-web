import type { PDFFont, PDFPage } from "pdf-lib";
import type { PrototypeParticipant } from "./types";

export type PrototypeCertificateInput = Readonly<{
  requestId: string;
  documentTitle: string;
  participants: readonly PrototypeParticipant[];
  consentVersion: string;
  sourceSha256: string;
  verificationId: string;
  completedAt: string;
}>;

function drawLine(
  page: PDFPage,
  font: PDFFont,
  text: string,
  y: number,
  size = 10
) {
  page.drawText(text, { x: 54, y, size, font, maxWidth: 504 });
}
export function drawPrototypeCertificatePage({
  page,
  font,
  boldFont,
  input,
}: {
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  input: PrototypeCertificateInput;
}) {
  page.drawText("BORIKIPR - PROTOTYPE COMPLETION SUMMARY", {
    x: 54,
    y: 730,
    size: 16,
    font: boldFont,
  });
  drawLine(page, font, "Phase 2A technical prototype - not a production signature request", 706, 9);
  drawLine(page, boldFont, `Request: ${input.requestId}`, 672);
  drawLine(page, font, `Document: ${input.documentTitle}`, 650);
  drawLine(page, font, `Completed: ${input.completedAt}`, 628);
  drawLine(page, font, `Consent version: ${input.consentVersion}`, 606);
  drawLine(page, font, `Verification ID: ${input.verificationId}`, 584);
  drawLine(page, boldFont, "Source PDF SHA-256", 548);
  drawLine(page, font, input.sourceSha256, 528, 8);
  drawLine(page, boldFont, "Participants", 492);
  let y = 470;
  for (const participant of input.participants) {
    drawLine(
      page,
      font,
      `${participant.displayName} | ${participant.role} | ${participant.completedAt}`,
      y,
      9
    );
    y -= 20;
  }
  drawLine(
    page,
    font,
    "The final PDF hash is intentionally stored only in the detached evidence manifest.",
    90,
    9
  );
}
