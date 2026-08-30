import { requireModuleAccess } from "@/lib/admin/access-context";
import { loadAdminCompletedArtifact, privatePdfResponse } from "@/lib/signatures/admin-download";
import { createSignatureRuntime } from "@/lib/signatures/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await requireModuleAccess("signatures", "view"); }
  catch { return new Response(null, { status: 404 }); }
  try {
    const { id } = await params; const runtime = createSignatureRuntime();
    const artifact = await loadAdminCompletedArtifact({ database: runtime.database, storage: runtime.storage, documentId: id, kind: "certificate" });
    return artifact ? privatePdfResponse(artifact.bytes, artifact.filename) : new Response(null, { status: 404 });
  } catch { return new Response(null, { status: 404 }); }
}
