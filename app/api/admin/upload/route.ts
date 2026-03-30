import { NextResponse } from "next/server";
import { uploadImageToR2 } from "@/lib/r2";
import { SESSION_COOKIE, verifyAdminSessionValue } from "@/lib/admin/auth";

export const runtime = "nodejs";

const MAX_FILES = 10;
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

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
      if (!ALLOWED_TYPES.has(file.type)) {
        return NextResponse.json(
          { ok: false, error: `Tipo no permitido: ${file.name}` },
          { status: 400 }
        );
      }

      const sizeMb = file.size / (1024 * 1024);
      if (sizeMb > MAX_SIZE_MB) {
        return NextResponse.json(
          { ok: false, error: `${file.name} excede ${MAX_SIZE_MB}MB.` },
          { status: 400 }
        );
      }
    }

    const urls: string[] = [];

    for (const file of files) {
      const url = await uploadImageToR2(file, "propiedades");
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