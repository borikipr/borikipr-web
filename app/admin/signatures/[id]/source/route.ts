import { getAdminSession } from "@/lib/admin/auth";
import { sql } from "@/lib/db";
import { createSignatureAdminRepository } from "@/lib/signatures/admin-repository";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { createPrivateSignatureStorage } from "@/lib/signatures/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'; sandbox",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await getAdminSession())) return new Response(null, { status: 401, headers: SECURITY_HEADERS });
  const { id } = await params;
  const repository = createSignatureAdminRepository(createPostgresSignatureDatabase(sql));
  const descriptor = await repository.sourceDescriptor(id);
  if (!descriptor) return new Response(null, { status: 404, headers: SECURITY_HEADERS });
  try {
    const bytes = await createPrivateSignatureStorage().getSource({
      key: descriptor.key,
      byteCount: descriptor.byteCount,
      sourceSha256: descriptor.sourceSha256,
    });
    return new Response(Uint8Array.from(bytes).buffer, {
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(descriptor.filename)}`,
      },
    });
  } catch {
    return new Response(null, { status: 404, headers: SECURITY_HEADERS });
  }
}
