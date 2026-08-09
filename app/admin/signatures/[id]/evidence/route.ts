import { getAdminSessionUser } from "@/lib/admin/auth";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { createSignatureDomainRuntime } from "@/lib/signatures/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSessionUser())) return new Response(null, { status: 404 });
  try {
    const { id } = await params; const runtime = createSignatureDomainRuntime();
    const descriptor = await createSignatureAdminRepository(runtime.database).completedDescriptor(id);
    if (!descriptor) return new Response(null, { status: 404 });
    const chain = await runtime.domain.verifyEventChain(id);
    return Response.json({
      documentId: descriptor.documentId, sourceSha256: descriptor.sourceSha256,
      fieldDefinitionSha256: descriptor.fieldDefinitionSha256,
      finalPdfSha256: descriptor.final.sha256, certificateSha256: descriptor.certificate.sha256,
      eventChainValid: chain.valid, evidence: descriptor.evidence,
    }, { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer" } });
  } catch { return new Response(null, { status: 404 }); }
}
