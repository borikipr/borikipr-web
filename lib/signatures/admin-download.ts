import { safeCompletedFilename } from "./completed-access";
import { createSignatureAdminRepository } from "./admin-repository";
import type { SignatureCompletedStorage } from "./storage";
import type { SignatureQueryExecutor } from "./domain/types";

export async function loadAdminCompletedArtifact(input: {
  database: SignatureQueryExecutor;
  storage: SignatureCompletedStorage;
  documentId: string;
  kind: "document" | "certificate";
}) {
  const descriptor = await createSignatureAdminRepository(input.database).completedDescriptor(input.documentId);
  if (!descriptor) return null;
  const selected = input.kind === "document" ? descriptor.final : descriptor.certificate;
  const bytes = input.kind === "document"
    ? await input.storage.getFinal(selected)
    : await input.storage.getCertificate(selected);
  return { bytes, filename: safeCompletedFilename(selected.filename) };
}

export function privatePdfResponse(bytes: Uint8Array, filename: string) {
  return new Response(Buffer.from(bytes), { headers: {
    "Content-Type": "application/pdf", "Content-Length": String(bytes.byteLength),
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; sandbox",
  }});
}
