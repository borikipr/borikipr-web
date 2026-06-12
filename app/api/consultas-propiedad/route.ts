import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isR2Configured, uploadImageToR2 } from "@/lib/r2";
import { checkRateLimit, getClientIp, nextRateLimitResponse } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);

function getText(formData: FormData, key: string) {
  return String(formData.get(key) || "").trim();
}

function getFile(formData: FormData, key: string) {
  const file = formData.get(key);
  return file instanceof File && file.size > 0 ? file : null;
}

function validateFile(file: File) {
  if (!ALLOWED_FILE_TYPES.has(file.type)) {
    return "Solo se aceptan PDF e imagenes JPG, PNG o WebP.";
  }

  if (file.size / (1024 * 1024) > MAX_FILE_SIZE_MB) {
    return `El archivo excede ${MAX_FILE_SIZE_MB}MB.`;
  }

  return "";
}

export async function POST(request: Request) {
  try {
    const rateLimit = checkRateLimit({
      key: `consultas-propiedad:${getClientIp(request)}`,
      limit: 5,
      windowMs: 10 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return nextRateLimitResponse();
    }

    const formData = await request.formData();
    const propiedadId = getText(formData, "propiedad_id");
    const nombre = getText(formData, "nombre");
    const telefono = getText(formData, "telefono");
    const email = getText(formData, "email").toLowerCase();
    const metodoCompra = getText(formData, "metodo_compra");
    const disponibilidadVisita = getText(formData, "disponibilidad_visita");
    const trabajandoConCorredor = getText(formData, "trabajando_con_corredor");
    const nombreCorredor = getText(formData, "nombre_corredor");
    const telefonoCorredor = getText(formData, "telefono_corredor");
    const fondosGastosCierre = getText(formData, "fondos_gastos_cierre");
    const respuestaPersonalizada = getText(formData, "respuesta_personalizada");

    if (!propiedadId || !nombre || !telefono || !metodoCompra || !disponibilidadVisita) {
      return NextResponse.json(
        { ok: false, error: "Completa los campos requeridos." },
        { status: 400 }
      );
    }

    const propiedades = await sql<{
      id: string;
      requiere_precalificacion: boolean | null;
      formulario_showing_activo: boolean;
      fecha_showing: string | Date | null;
      pregunta_personalizada: string | null;
    }[]>`
      SELECT id, requiere_precalificacion, formulario_showing_activo, fecha_showing, pregunta_personalizada
      FROM propiedades
      WHERE id = ${propiedadId}
      LIMIT 1
    `;

    const propiedad = propiedades[0];

    if (!propiedad || !propiedad.formulario_showing_activo || !propiedad.fecha_showing) {
      return NextResponse.json(
        { ok: false, error: "Este formulario no esta activo para la propiedad." },
        { status: 403 }
      );
    }

    const cartaFile = getFile(formData, "carta_precalificacion");
    const evidenciaFile = getFile(formData, "evidencia_fondos_archivo");
    const needsPreapproval =
      Boolean(propiedad.requiere_precalificacion) && metodoCompra === "Financiamiento";

    if (needsPreapproval && !cartaFile && isR2Configured()) {
      return NextResponse.json(
        { ok: false, error: "La carta de preaprobacion es requerida para esta propiedad." },
        { status: 400 }
      );
    }

    for (const file of [cartaFile, evidenciaFile]) {
      if (!file) continue;
      const validationError = validateFile(file);
      if (validationError) {
        return NextResponse.json({ ok: false, error: validationError }, { status: 400 });
      }
    }

    let cartaPrecalificacionUrl: string | null = null;
    let evidenciaFondos: string | null = null;

    if (isR2Configured()) {
      if (cartaFile) {
        cartaPrecalificacionUrl = await uploadImageToR2(cartaFile, "consultas-propiedad/precalificaciones");
      }
      if (evidenciaFile) {
        evidenciaFondos = await uploadImageToR2(evidenciaFile, "consultas-propiedad/evidencia-fondos");
      }
    }

    const respuestasPersonalizadas = {
      pregunta_personalizada: propiedad.pregunta_personalizada,
      respuesta_personalizada: respuestaPersonalizada || null,
      r2_configurado: isR2Configured(),
    };

    await sql`
      INSERT INTO consultas_propiedad (
        propiedad_id,
        nombre,
        telefono,
        email,
        metodo_compra,
        carta_precalificacion_url,
        evidencia_fondos,
        fondos_gastos_cierre,
        trabajando_con_corredor,
        nombre_corredor,
        telefono_corredor,
        disponibilidad_visita,
        respuestas_personalizadas
      ) VALUES (
        ${propiedadId},
        ${nombre},
        ${telefono},
        ${email || null},
        ${metodoCompra},
        ${cartaPrecalificacionUrl},
        ${evidenciaFondos},
        ${fondosGastosCierre || null},
        ${trabajandoConCorredor || null},
        ${nombreCorredor || null},
        ${telefonoCorredor || null},
        ${disponibilidadVisita},
        ${sql.json(respuestasPersonalizadas)}
      )
    `;

    return NextResponse.json({
      ok: true,
      uploadSkipped: Boolean((cartaFile || evidenciaFile) && !isR2Configured()),
    });
  } catch (error) {
    console.error("CONSULTA PROPIEDAD ERROR:", error);
    return NextResponse.json(
      { ok: false, error: "No se pudo enviar el formulario." },
      { status: 500 }
    );
  }
}
