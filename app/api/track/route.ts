import { NextResponse } from "next/server";
import { trackLeadEvent } from "@/lib/queries/leads";
import { checkRateLimit, getClientIp, nextRateLimitResponse } from "@/lib/rate-limit";

const EVENT_TYPES = new Set(["contact_click", "whatsapp_click"]);

export async function POST(req: Request) {
  try {
    const rateLimit = await checkRateLimit({
      key: `track:${getClientIp(req)}`,
      limit: 60,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return nextRateLimitResponse();
    }

    const body = await req.json();

    const slug =
      typeof body.slug === "string" && body.slug.trim()
        ? body.slug.trim()
        : null;

    const tipo =
      typeof body.tipo === "string" && body.tipo.trim()
        ? body.tipo.trim()
        : "";

    const rutaOrigen =
      typeof body.rutaOrigen === "string" && body.rutaOrigen.trim()
        ? body.rutaOrigen.trim()
        : null;

    if (!tipo || !EVENT_TYPES.has(tipo)) {
      return NextResponse.json(
        { ok: false, error: "Tipo de evento invalido." },
        { status: 400 }
      );
    }

    await trackLeadEvent(slug, tipo, rutaOrigen);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Tracking error:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
