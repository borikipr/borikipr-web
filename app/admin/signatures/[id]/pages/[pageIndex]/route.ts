import { requireModuleAccess } from "@/lib/admin/access-context";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { renderPdfWithPdfJs } from "@/lib/signatures/prototype/render";
import { createPrivateSignatureStorage } from "@/lib/signatures/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; pageIndex: string }> }
) {
  try { await requireModuleAccess("signatures", "view"); }
  catch { return new Response(null, { status: 404, headers: HEADERS }); }
  const { id, pageIndex: pageValue } = await params;
  const pageIndex = Number(pageValue);
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex >= 25) {
    return new Response(null, { status: 404, headers: HEADERS });
  }
  const repository = createSignatureAdminRepository(createPostgresSignatureDatabase(sql));
  const descriptor = await repository.sourceDescriptor(id);
  if (!descriptor) return new Response(null, { status: 404, headers: HEADERS });
  try {
    const bytes = await createPrivateSignatureStorage().getSource({
      key: descriptor.key,
      byteCount: descriptor.byteCount,
      sourceSha256: descriptor.sourceSha256,
    });
    const rendered = await renderPdfWithPdfJs(bytes, 1.5);
    const page = rendered[pageIndex];
    if (!page) return new Response(null, { status: 404, headers: HEADERS });
    return new Response(Uint8Array.from(page.pngBytes).buffer, {
      headers: { ...HEADERS, "Content-Type": "image/png", "Content-Length": String(page.pngBytes.byteLength) },
    });
  } catch {
    return new Response(null, { status: 404, headers: HEADERS });
  }
}
