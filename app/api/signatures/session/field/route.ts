import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isPublicSigningEnabled } from "@/lib/signatures/public-config";
import { requireSignerRequestContext, sameSignerOrigin } from "@/lib/signatures/signer/request";
import type { DrawnStroke } from "@/lib/signatures/prototype/types";

function parseStrokes(value: FormDataEntryValue | null): readonly DrawnStroke[] {
  if (typeof value !== "string" || value.length > 100_000) throw new Error("signature_strokes_invalid");
  const parsed: unknown = JSON.parse(value);
  if (!Array.isArray(parsed)) throw new Error("signature_strokes_invalid");
  return parsed as readonly DrawnStroke[];
}

export async function POST(request: Request) {
  if (!isPublicSigningEnabled() || !sameSignerOrigin(request)) return new Response(null, { status: 404 });
  const form = await request.formData().catch(() => null);
  if (!form) return new Response(null, { status: 400 });
  const csrfNonce = String(form.get("csrf") ?? "");
  try {
    const signer = await requireSignerRequestContext({ csrfNonce });
    const method = String(form.get("method") ?? "");
    const value = method === "drawn"
      ? { method: "drawn" as const, strokes: parseStrokes(form.get("strokes")) }
      : method === "date"
        ? { method: "date" as const, value: String(form.get("value") ?? "") }
        : method === "text"
          ? { method: "text" as const, value: String(form.get("value") ?? "") }
          : { method: "typed" as const, value: String(form.get("value") ?? "") };
    await signer.runtime.domain.submitSignerField({
      sessionId: signer.sessionId, sessionSecret: signer.sessionSecret, csrfNonce,
      fieldId: String(form.get("fieldId") ?? ""), value, idempotencyKey: randomUUID(),
    });
    return NextResponse.redirect(new URL("/firmar/sesion", request.url), 303);
  } catch { return new Response(null, { status: 400 }); }
}
