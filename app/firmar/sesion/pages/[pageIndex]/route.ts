import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { requireSignerRequestContext } from "@/lib/signatures/signer/request";
import { createSignerRepository } from "@/lib/signatures/signer/repository";
import { createPrivateSignatureStorage } from "@/lib/signatures/storage";
import { renderPdfWithPdfJs } from "@/lib/signatures/prototype/render";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow, noarchive" };

export async function GET(_request: Request, { params }: { params: Promise<{ pageIndex: string }> }) {
  if (!isPublicSigningEnabled()) return new Response(null, { status: 404, headers: HEADERS });
  try {
    const signer = await requireSignerRequestContext();
    const descriptor = await createSignerRepository(signer.runtime.database).sourceDescriptor(signer.context.documentVersionId);
    const pageIndex = Number((await params).pageIndex);
    if (!descriptor || !Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex > 24) throw new Error("not_found");
    const bytes = await createPrivateSignatureStorage().getSource({ key: descriptor.key, byteCount: descriptor.byte_count, sourceSha256: descriptor.source_sha256 });
    const page = (await renderPdfWithPdfJs(bytes, 1.5))[pageIndex];
    if (!page) throw new Error("not_found");
    return new Response(Uint8Array.from(page.pngBytes).buffer, { headers: { ...HEADERS, "Content-Type": "image/png" } });
  } catch { return new Response(null, { status: 404, headers: HEADERS }); }
}
