import { getAdminSession } from "@/lib/admin/auth";
import {
  getAdminPrivateShowingLink,
  regenerateAdminPrivateShowingLink,
} from "@/lib/leads/private-showing-access";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  if (!(await getAdminSession())) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ ok: false }, { status: 404 });
  const url = await getAdminPrivateShowingLink(id);
  return url
    ? Response.json({ ok: true, url }, { headers: { "cache-control": "no-store" } })
    : Response.json({ ok: false }, { status: 404 });
}

export async function POST(request: Request, context: RouteContext) {
  const session = await getAdminSession();
  if (!session) return Response.json({ ok: false }, { status: 401 });
  if (!isSameOrigin(request)) {
    return Response.json({ ok: false }, { status: 403 });
  }
  const { id } = await context.params;
  if (!isUuid(id)) return Response.json({ ok: false }, { status: 404 });
  const body = (await request.json().catch(() => null)) as {
    confirmation?: unknown;
  } | null;
  if (body?.confirmation !== "REGENERAR") {
    return Response.json(
      { ok: false, error: "Confirma la regeneración del enlace." },
      { status: 400 }
    );
  }
  const url = await regenerateAdminPrivateShowingLink(id);
  return url
    ? Response.json({ ok: true, url }, { headers: { "cache-control": "no-store" } })
    : Response.json({ ok: false }, { status: 404 });
}

function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
