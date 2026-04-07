import { NextResponse } from "next/server";
import { trackLeadEvent } from "@/lib/queries/leads";

export async function POST(req: Request) {
  try {
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

    if (!tipo) {
      return NextResponse.json(
        { ok: false, error: "tipo_evento es requerido" },
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