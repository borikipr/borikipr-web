import { readFile } from "node:fs/promises";
import path from "node:path";
import QRCode from "qrcode";
import { AdminAccessError, requireModuleAccess } from "@/lib/admin/access-context";
import { buildPropertyBrochure } from "@/lib/brochures/property-brochure";
import { getPropertyBrochureData } from "@/lib/brochures/property-brochure-data";
import { fetchPropertyBrochureImages } from "@/lib/brochures/property-brochure-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SECURITY_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex",
  "X-Content-Type-Options": "nosniff",
};

function errorResponse(message: string, status: number) {
  return Response.json({ ok: false, error: message }, { status, headers: SECURITY_HEADERS });
}

export function brochureFilename(slug: string) {
  const safeSlug = slug
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return `${safeSlug || "propiedad"}-brochure.pdf`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let propertyId = "unknown";
  try {
    await requireModuleAccess("properties", "view");
    propertyId = (await params).id;
    if (!UUID_PATTERN.test(propertyId)) return errorResponse("Propiedad no encontrada.", 404);

    const property = await getPropertyBrochureData(propertyId);
    if (!property) return errorResponse("Propiedad no encontrada.", 404);

    const [images, qrPng, logoPng] = await Promise.all([
      fetchPropertyBrochureImages(property.imageUrls),
      QRCode.toBuffer(property.canonicalUrl, {
        type: "png",
        width: 360,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#11518B", light: "#FFFFFFFF" },
      }),
      readFile(path.join(process.cwd(), "public", "logo-erickson.png")).catch(() => null),
    ]);

    const brochure = await buildPropertyBrochure({
      property,
      images,
      qrPng: new Uint8Array(qrPng),
      logoPng: logoPng ? new Uint8Array(logoPng) : null,
    });

    return new Response(Buffer.from(brochure.bytes), {
      status: 200,
      headers: {
        ...SECURITY_HEADERS,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${brochureFilename(property.slug)}"`,
      },
    });
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return errorResponse(
        error.code === "unauthenticated" ? "No autorizado." : "Acceso denegado.",
        error.code === "unauthenticated" ? 401 : 403,
      );
    }
    console.error("PROPERTY BROCHURE GENERATION ERROR", {
      propertyId,
      errorType: error instanceof Error ? error.name : "unknown",
    });
    return errorResponse("No se pudo generar el brochure.", 500);
  }
}
