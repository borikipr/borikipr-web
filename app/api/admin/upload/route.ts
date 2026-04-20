import { NextResponse } from "next/server";
import { uploadImageToR2 } from "@/lib/r2";
import { SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/admin/auth";

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

export async function POST(request: Request) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const sessionCookie = cookieHeader
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`));

    const sessionValue = sessionCookie
      ? decodeURIComponent(sessionCookie.split("=").slice(1).join("="))
      : null;

    const adminUser = verifyAdminSessionValue(sessionValue);

    if (!adminUser) {
      return NextResponse.json(
        { ok: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (files.length === 0) {
      return NextResponse.json(
        { ok: false, error: "No se recibieron archivos." },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { ok: false, error: `Máximo ${MAX_FILES} archivos por subida.` },
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
      const maxSize = isVideo ? MAX_VIDEO_SIZE_MB : MAX_IMAGE_SIZE_MB;
      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > maxSize) {
        return NextResponse.json(
          { ok: false, error: `${file.name} excede ${maxSize}MB.` },
          { status: 400 }
        );
      }
    }

    const urls: string[] = [];

    for (const file of files) {
      const isVideo = ALLOWED_VIDEO_TYPES.has(file.type);
      const folder = isVideo ? "propiedades/videos" : "propiedades";
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