import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { isR2Configured, uploadImageToR2 } from "@/lib/r2";
import { checkRateLimit, getClientIp, nextRateLimitResponse } from "@/lib/rate-limit";
import { isOpenHousePersistenceEnabled } from "@/lib/leads/open-house-registration";
import { handleOpenHouseRegistrationV2 } from "@/lib/leads/open-house-registration-handler";

export const runtime = "nodejs";

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
]);
const PURCHASE_METHODS = new Set(["Financiamiento", "Cash", "Otro"]);
const ATTENDANCE_ANSWERS = new Set(["Sí", "No"]);
const CLOSING_FUNDS_ANSWERS = new Set(["Sí", "Parcialmente", "Aún no"]);
const SOLAR_ANSWERS = new Set(["yes", "no"]);

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
  if (isOpenHousePersistenceEnabled()) {
    return handleOpenHouseRegistrationV2(request);
  }

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
    const metodoCompraOtro = getText(formData, "metodoCompraOtro");
    const disponibilidadVisita = getText(formData, "disponibilidad_visita");
    const trabajandoConCorredor = getText(formData, "trabajando_con_corredor");
    const nombreCorredor = getText(formData, "nombre_corredor");
    const telefonoCorredor = getText(formData, "telefono_corredor");
    const fondosGastosCierre = getText(formData, "fondos_gastos_cierre");
    const solarContractAcceptance = getText(
      formData,
      "solarContractAcceptance"
    );

    if (
      !propiedadId ||
      !nombre ||
      !telefono ||
      !PURCHASE_METHODS.has(metodoCompra) ||
      !ATTENDANCE_ANSWERS.has(disponibilidadVisita) ||
      !CLOSING_FUNDS_ANSWERS.has(fondosGastosCierre)
    ) {
      return NextResponse.json(
        { ok: false, error: "Completa los campos requeridos." },
        { status: 400 }
      );
    }
    if (
      (metodoCompra === "Otro" && !metodoCompraOtro) ||
      (metodoCompra !== "Otro" && metodoCompraOtro)
    ) {
      return NextResponse.json(
        { ok: false, error: "Especifica un método de compra válido." },
        { status: 400 }
      );
    }

    const propiedades = await sql<{
      id: string;
      requiere_precalificacion: boolean | null;
      formulario_showing_activo: boolean;
      fecha_showing: string | Date | null;
      placas_en_lease: boolean | null;
    }[]>`
      SELECT id, requiere_precalificacion, formulario_showing_activo, fecha_showing, placas_en_lease
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
    if (
      (propiedad.placas_en_lease &&
        !SOLAR_ANSWERS.has(solarContractAcceptance)) ||
      (!propiedad.placas_en_lease && solarContractAcceptance)
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Selecciona una respuesta válida sobre el contrato o leasing de las placas solares.",
        },
        { status: 400 }
      );
    }

    const cartaFile = getFile(formData, "carta_precalificacion");
    const evidenciaFile = getFile(formData, "evidencia_fondos_archivo");
    if (metodoCompra === "Financiamiento" && !cartaFile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La carta de precalificación es requerida para completar este registro.",
        },
        { status: 400 }
      );
    }
    if (metodoCompra === "Cash" && !evidenciaFile) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "La evidencia de fondos es requerida para completar este registro.",
        },
        { status: 400 }
      );
    }
    if (metodoCompra === "Financiamiento" && evidenciaFile) {
      return NextResponse.json(
        {
          ok: false,
          error: "La evidencia de fondos no aplica a financiamiento.",
        },
        { status: 400 }
      );
    }
    if (metodoCompra === "Cash" && cartaFile) {
      return NextResponse.json(
        {
          ok: false,
          error: "La carta de precalificación no aplica a una compra Cash.",
        },
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
      purchase_method_other:
        metodoCompra === "Otro" ? metodoCompraOtro : null,
      solar_contract_acceptance: propiedad.placas_en_lease
        ? solarContractAcceptance
        : null,
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
