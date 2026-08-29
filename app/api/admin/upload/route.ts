import { NextResponse } from "next/server";
import { uploadImageToR2 } from "@/lib/r2";
import { SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/admin/auth";
import { sameSignerOrigin } from "@/lib/signatures/signer/origin";
import { requireAdminAccess, requireModuleAccess } from "@/lib/admin/access-context";

export const runtime = "nodejs";

const MAX_FILES = 10;
const MAX_IMAGE_SIZE_MB = 10;
const MAX_VIDEO_SIZE_MB = 50;
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);
const ALL_ALLOWED_TYPES = new Set([...ALLOWED_IMAGE_TYPES, ...ALLOWED_VIDEO_TYPES]);

function matchesDeclaredType(type: string, bytes: Uint8Array) {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.slice(start, start + length));
  if (type === "image/jpeg" || type === "image/jpg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png") return bytes[0] === 0x89 && ascii(1, 3) === "PNG";
  if (type === "image/webp") return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  if (type === "video/webm") return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (type === "video/mp4" || type === "video/quicktime") return ascii(4, 4) === "ftyp";
  return false;
}

export async function POST(request: Request) {
  try {
    if (!sameSignerOrigin(request)) {
      return NextResponse.json({ ok: false, error: "Origen no autorizado." }, { status: 403 });
    }
    const cookieHeader = request.headers.get("cookie") || "";
    const sessionCookie = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

    const sessionValue = sessionCookie
      ? decodeURIComponent(sessionCookie.split("=").slice(1).join("="))
      : null;

    const adminUser = await verifyAdminSessionValue(sessionValue);

    if (!adminUser) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 401 }
      );
    }
    try { await requireAdminAccess(); }
    catch { return NextResponse.json({ ok: false, error: "No autorizado." }, { status: 401 }); }

    const formData = await request.formData();
    const purpose = String(formData.get("purpose") || "property");
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (purpose !== "property" && purpose !== "testimonial" && purpose !== "profile") {
      return NextResponse.json({ ok: false, error: "Destino de carga no válido." }, { status: 400 });
    }
    if (purpose !== "profile") {
      try { await requireModuleAccess(purpose === "property" ? "properties" : "testimonials", "manage"); }
      catch { return NextResponse.json({ ok: false, error: "No tienes acceso para esta carga." }, { status: 403 }); }
    }

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se recibieron archivos." },
        { status: 400 }
      );
    }

    const maxFiles = purpose === "testimonial" || purpose === "profile" ? 1 : MAX_FILES;
    if (files.length > maxFiles) {
      return NextResponse.json(
        { ok: false, error: `Máximo ${maxFiles} archivos por subida.` },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (!ALL_ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { ok: false, error: `Tipo no permitido: ${file.name}. Se aceptan imágenes (JPG, PNG, WebP) y videos (MP4, WebM).` },
          { status: 400 }
        );
      }

      const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
      if ((purpose === "testimonial" || purpose === "profile") && isVideo) {
        return NextResponse.json({ ok: false, error: purpose === "profile" ? "El perfil solo acepta imágenes." : "Los testimonios solo aceptan imágenes." }, { status: 400 });
      }
      const maxSize = purpose === "testimonial" || purpose === "profile" ? 5 : isVideo ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB;
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxSize) {
        return NextResponse.json(
          { ok: false, error: `${file.name} excede ${maxSize}MB.` },
          { status: 400 }
        );
      }

      const signature = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      if (!matchesDeclaredType(file.type, signature)) {
        return NextResponse.json({ ok: false, error: `${file.name} no coincide con su formato declarado.` }, { status: 400 });
      }
    }

    const urls: string[] = [];

    for (const file of files) {
      const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
      const folder = purpose === "testimonial" ? "testimonios" : purpose === "profile" ? "perfiles" : isVideo ? "propiedades/videos" : "propiedades";
      const url = await uploadImageToR2(file, folder);
      urls.push(url);
    }

    return NextResponse.json({ ok: true, urls });
  } catch (error) {
    console.error("UPLOAD ADMIN ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "No se pudieron subir las imágenes." },
      { status: 500 }
    );
  }
}
