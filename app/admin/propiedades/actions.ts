"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { municipiosPR } from "@/data/municipios";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { Resend } from "resend";
import { absoluteUrl } from "@/lib/seo";
import { normalizeSectorForMunicipio } from "@/lib/puerto-rico-sectores";

export type CreatePropiedadState = {
  error: string;
};

const municipiosValidos = new Set(municipiosPR);
const tiposNegocioValidos = new Set(["venta", "renta"]);
const tiposPropiedadValidos = new Set([
  "Casa",
  "Apartamento",
  "Condominio",
  "Terreno",
  "Comercial",
]);
const estadosValidos = new Set([
  "disponible",
  "coming_soon",
  "bajo_contrato",
  "vendida",
  "rentada",
]);
const origenListadoValidos = new Set(["propio", "co_broke"]);
const origenListadoLegacyValidos = new Set(["propio", "co_broke", "externo"]);

function parsePositiveNumber(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function buildUniqueSlug(baseValue: string) {
  const baseSlug = normalizeSlug(baseValue);

  if (!baseSlug) {
    return "";
  }

  const existingRows = await sql<{ slug: string }[]>`
    SELECT slug
    FROM propiedades
    WHERE slug = ${baseSlug}
      OR slug LIKE ${`${baseSlug}-%`}
  `;
  const existingSlugs = new Set(existingRows.map((row) => row.slug));

  if (!existingSlugs.has(baseSlug)) {
    return baseSlug;
  }

  let suffix = 2;
  let candidate = `${baseSlug}-${suffix}`;

  while (existingSlugs.has(candidate)) {
    suffix += 1;
    candidate = `${baseSlug}-${suffix}`;
  }

  return candidate;
}

function buildSlugBase(titulo: string, sectorComunidad: string, municipio: string) {
  const normalizedTitle = normalizeSlug(titulo);
  const normalizedSector = normalizeSlug(sectorComunidad);

  if (normalizedSector && !normalizedTitle.includes(normalizedSector)) {
    return `${titulo} ${sectorComunidad} ${municipio}`;
  }

  return `${titulo} ${municipio}`;
}

function buildShowingDateTime(dateValue: string, timeValue: string) {
  if (!dateValue || !timeValue) return null;
  return `${dateValue} ${timeValue}:00`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function requireAdminSession() {
  const user = await getAdminSessionUser();
  if (!user) {
    throw new Error("No autorizado.");
  }
}

type PriorityRegistration = {
  id: string;
  name: string;
  email: string;
};

async function notifyPriorityRegistrationsForAvailableProperty({
  propertyId,
  propertyTitle,
  propertySlug,
}: {
  propertyId: string;
  propertyTitle: string;
  propertySlug: string;
}) {
  console.info("AVAILABILITY NOTIFICATION FUNCTION STARTED", {
    propertyId,
    propertySlug,
    propertyTitle,
  });

  const registrations = await sql<PriorityRegistration[]>`
    SELECT id::text, name, email
    FROM property_priority_registrations
    WHERE property_id = ${propertyId}
      AND notified_at IS NULL
    ORDER BY created_at ASC
  `;

  console.info("PRIORITY REGISTRATION AVAILABILITY LOOKUP:", {
    propertyId,
    propertySlug,
    propertyTitle,
    pendingRegistrations: registrations.length,
  });

  if (registrations.length === 0) {
    return;
  }

  if (!process.env.RESEND_API_KEY) {
    console.error(
      "PRIORITY REGISTRATION NOTIFICATION ERROR: Missing RESEND_API_KEY"
    );
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromEmail =
    process.env.CONTACT_FROM_EMAIL?.trim() || "onboarding@resend.dev";
  const propertyUrl = absoluteUrl(`/listados/${propertySlug}`);
  let attempted = 0;
  let sent = 0;
  let failed = 0;

  for (const registration of registrations) {
    try {
      attempted += 1;
      console.info("PRIORITY REGISTRATION RESEND ATTEMPT:", {
        propertyId,
        registrationId: registration.id,
        email: registration.email,
      });
      const { error } = await resend.emails.send({
        from: `Erickson Real Estate <${fromEmail}>`,
        to: [registration.email],
        subject: "La propiedad que te interesó ya está disponible",
        html: `
          <div style="font-family: Arial, Helvetica, sans-serif; color: #111; line-height: 1.6; padding: 24px;">
            <div style="max-width: 640px; margin: 0 auto; border: 1px solid #e8e8e8; border-radius: 18px; overflow: hidden;">
              <div style="background: #11518b; padding: 20px 24px;">
                <h2 style="margin: 0; color: #d4af37; font-size: 22px;">La propiedad ya está disponible</h2>
              </div>
              <div style="padding: 24px;">
                <p style="margin: 0 0 12px;">Hola ${escapeHtml(registration.name)},</p>
                <p style="margin: 0 0 12px;">
                  La propiedad que te interesó ya está disponible. Como completaste el registro prioritario, estás recibiendo esta información antes que el público general.
                </p>
                <p style="margin: 0 0 12px;"><strong>Propiedad:</strong> ${escapeHtml(propertyTitle)}</p>
                <p style="margin: 0 0 18px;">
                  <strong>Enlace:</strong>
                  <a href="${propertyUrl}" style="color: #11518b;">${propertyUrl}</a>
                </p>
                <div style="border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; margin: 22px 0; padding: 18px 0;">
                  <p style="margin: 0 0 8px; color: #11518b; font-weight: 700;">Próximo paso</p>
                  <p style="margin: 0 0 10px;">
                    Si deseas avanzar con el proceso o coordinar una visita, completa tu perfil de comprador aquí:
                  </p>
                  <p style="margin: 0;">
                    <a href="https://borikipr.com/contact/perfil-comprador" style="color: #11518b; font-weight: 700;">
                      https://borikipr.com/contact/perfil-comprador
                    </a>
                  </p>
                </div>
                <p style="margin: 0 0 18px;">
                  Si deseas coordinar una visita, comunícate con Erickson Real Estate / Ivonne para confirmar disponibilidad y próximos pasos.
                </p>
                <p style="margin: 0;">
                  Gracias por tu interés,<br />
                  Ivonne Erickson<br />
                  Erickson Real Estate
                </p>
              </div>
            </div>
          </div>
        `,
      });

      if (error) {
        console.error("PRIORITY REGISTRATION EMAIL ERROR:", {
          registrationId: registration.id,
          email: registration.email,
          error,
        });
        failed += 1;
        continue;
      }

      await sql`
        UPDATE property_priority_registrations
        SET notified_at = now()
        WHERE id = ${registration.id}
          AND notified_at IS NULL
      `;
      sent += 1;
      console.info(`AVAILABILITY EMAIL SENT TO: ${registration.email}`);
    } catch (error) {
      console.error("PRIORITY REGISTRATION EMAIL ERROR:", {
        registrationId: registration.id,
        email: registration.email,
        error,
      });
      failed += 1;
    }
  }

  console.info("PRIORITY REGISTRATION AVAILABILITY SUMMARY:", {
    propertyId,
    propertySlug,
    propertyTitle,
    pendingRegistrations: registrations.length,
    attempted,
    sent,
    failed,
  });
}

export async function createPropiedadAction(
  _prevState: CreatePropiedadState,
  formData: FormData
): Promise<CreatePropiedadState> {
  await requireAdminSession();

  const titulo = String(formData.get("titulo") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim();
  const municipio = String(formData.get("municipio") || "").trim();
  const sectorComunidadRaw = String(formData.get("sector_comunidad") || "").trim();
  const precioRaw = String(formData.get("precio") || "").trim();
  const tipoNegocio = String(formData.get("tipo_negocio") || "").trim();
  const tipoPropiedad = String(formData.get("tipo_propiedad") || "").trim();
  const habitacionesRaw = String(formData.get("habitaciones") || "").trim();
  const banosRaw = String(formData.get("banos") || "").trim();
  const estacionamientosRaw = String(
    formData.get("estacionamientos") || ""
  ).trim();
  const metrosRaw = String(formData.get("metros_cuadrados") || "").trim();
  const estado = String(formData.get("estado") || "").trim();
  const destacado = formData.get("destacado") === "on";
  const imagenesRaw = String(formData.get("imagenes") || "").trim();
  const origenListado = String(formData.get("origen_listado") || "propio").trim();
  const corredorNombre = String(formData.get("corredor_colaborador_nombre") || "").trim();
  const corredorEmpresa = String(formData.get("corredor_colaborador_empresa") || "").trim();
  const corredorContacto = String(formData.get("corredor_colaborador_contacto") || "").trim();
  const enlaceOriginal = String(formData.get("enlace_original") || "").trim();
  const permisoPublicar = formData.get("permiso_publicar_web") === "on";
  const permisoFotos = formData.get("permiso_usar_fotos") === "on";
  const notasInternas = String(formData.get("notas_internas") || "").trim();
  const formularioShowingActivo = formData.get("formulario_showing_activo") === "on";
  const fechaShowing = buildShowingDateTime(
    String(formData.get("fecha_showing_fecha") || "").trim(),
    String(formData.get("fecha_showing_hora") || "").trim()
  );
  const requierePrecalificacion = formData.get("requiere_precalificacion") === "on";
  const preguntaPersonalizada = String(formData.get("pregunta_personalizada") || "").trim();
  const tienePlacasSolares = formData.get("tiene_placas_solares") === "on";
  const cantidadPlacas = parsePositiveNumber(String(formData.get("cantidad_placas") || "0").trim() || "0");
  const placasEnLease = formData.get("placas_en_lease") === "on";
  const aceptaCdbg = formData.get("acepta_cdbg") === "on";
  const notasCompradores = String(formData.get("notas_compradores") || "").trim();

  if (
    !titulo ||
    !descripcion ||
    !municipio ||
    !tipoNegocio ||
    !tipoPropiedad ||
    !estado
  ) {
    return { error: "Completa todos los campos obligatorios." };
  }

  if (!municipiosValidos.has(municipio as never)) {
    return { error: "Selecciona un municipio válido." };
  }

  const sectorComunidad = normalizeSectorForMunicipio(municipio, sectorComunidadRaw);
  const slug = await buildUniqueSlug(buildSlugBase(titulo, sectorComunidad, municipio));

  if (!slug) {
    return { error: "No se pudo generar el slug de la propiedad." };
  }

  if (!tiposNegocioValidos.has(tipoNegocio as never)) {
    return { error: "Selecciona un tipo de negocio válido." };
  }

  if (!tiposPropiedadValidos.has(tipoPropiedad as never)) {
    return { error: "Selecciona un tipo de propiedad válido." };
  }

  if (!estadosValidos.has(estado as never)) {
    return { error: "Selecciona un estado válido." };
  }

  if (!origenListadoValidos.has(origenListado as never)) {
    return { error: "Selecciona un origen de listado válido." };
  }

  if (origenListado === "co_broke" && !corredorNombre) {
    return { error: "El nombre del corredor colaborador es requerido para co-broke." };
  }

  const precio = estado === "coming_soon" && !precioRaw
    ? 0
    : parsePositiveNumber(precioRaw);
  const habitaciones = parsePositiveNumber(habitacionesRaw || "0");
  const banos = parsePositiveNumber(banosRaw || "0");
  const estacionamientos = parsePositiveNumber(estacionamientosRaw || "0");
  const metrosCuadrados = parsePositiveNumber(metrosRaw || "0");

  if (precio === null || (estado !== "coming_soon" && !precioRaw)) {
    return { error: "El precio debe ser un número válido." };
  }

  if (cantidadPlacas === null) {
    return { error: "La cantidad de placas debe ser un numero valido." };
  }

  if (formularioShowingActivo && !fechaShowing) {
    return { error: "Indica fecha y hora para activar el formulario de showing." };
  }

  if (
    habitaciones === null ||
    banos === null ||
    estacionamientos === null ||
    metrosCuadrados === null
  ) {
    return {
      error:
        "Habitaciones, baños, estacionamientos y metros deben ser válidos.",
    };
  }

  const imagenes = imagenesRaw
    .split(",")
    .map((img) => img.trim())
    .filter(Boolean);

  let insertadaId = "";

  try {
    const insertadas = await sql<{ id: string }[]>`
      INSERT INTO propiedades (
        slug,
        titulo,
        descripcion,
        municipio,
        sector_comunidad,
        precio,
        tipo_negocio,
        tipo_propiedad,
        habitaciones,
        banos,
        estacionamientos,
        metros_cuadrados,
        estado,
        destacado,
        origen_listado,
        corredor_colaborador_nombre,
        corredor_colaborador_empresa,
        corredor_colaborador_contacto,
        enlace_original,
        permiso_publicar_web,
        permiso_usar_fotos,
        notas_internas,
        formulario_showing_activo,
        fecha_showing,
        requiere_precalificacion,
        pregunta_personalizada,
        tiene_placas_solares,
        cantidad_placas,
        placas_en_lease,
        acepta_cdbg,
        configuracion_formulario
      ) VALUES (
        ${slug},
        ${titulo},
        ${descripcion},
        ${municipio},
        ${sectorComunidad || null},
        ${precio},
        ${tipoNegocio},
        ${tipoPropiedad},
        ${habitaciones},
        ${banos},
        ${estacionamientos},
        ${metrosCuadrados},
        ${estado},
        ${destacado},
        ${origenListado},
        ${corredorNombre || null},
        ${corredorEmpresa || null},
        ${corredorContacto || null},
        ${enlaceOriginal || null},
        ${permisoPublicar},
        ${permisoFotos},
        ${notasInternas || null},
        ${formularioShowingActivo},
        ${fechaShowing},
        ${requierePrecalificacion},
        ${preguntaPersonalizada || null},
        ${tienePlacasSolares},
        ${cantidadPlacas},
        ${placasEnLease},
        ${aceptaCdbg},
        ${sql.json({ notas_compradores: notasCompradores })}
      )
      RETURNING id
    `;

    const insertada = insertadas[0];
    insertadaId = insertada.id;

    for (let i = 0; i < imagenes.length; i++) {
      await sql`
        INSERT INTO propiedad_imagenes (propiedad_id, url, orden)
        VALUES (${insertada.id}, ${imagenes[i]}, ${i + 1})
      `;
    }

    revalidatePath("/admin/propiedades");
    revalidatePath("/listados");
    revalidatePath("/");
  } catch (error) {
    console.error("CREATE PROPIEDAD ERROR:", error);
    return { error: "No se pudo crear la propiedad." };
  }

  redirect(`/admin/propiedades?ok=created&id=${insertadaId}`);
}

export type UpdatePropiedadState = {
  error: string;
};

export async function updatePropiedadAction(
  _prevState: UpdatePropiedadState,
  formData: FormData
): Promise<UpdatePropiedadState> {
  await requireAdminSession();

  const id = String(formData.get("id") || "").trim();
  const slugRaw = String(formData.get("slug") || "");
  const titulo = String(formData.get("titulo") || "").trim();
  const descripcion = String(formData.get("descripcion") || "").trim();
  const municipio = String(formData.get("municipio") || "").trim();
  const sectorComunidadRaw = String(formData.get("sector_comunidad") || "").trim();
  const precioRaw = String(formData.get("precio") || "").trim();
  const tipoNegocio = String(formData.get("tipo_negocio") || "").trim();
  const tipoPropiedad = String(formData.get("tipo_propiedad") || "").trim();
  const habitacionesRaw = String(formData.get("habitaciones") || "").trim();
  const banosRaw = String(formData.get("banos") || "").trim();
  const estacionamientosRaw = String(
    formData.get("estacionamientos") || ""
  ).trim();
  const metrosRaw = String(formData.get("metros_cuadrados") || "").trim();
  const estado = String(formData.get("estado") || "").trim();
  const destacado = formData.get("destacado") === "on";
  const imagenesRaw = String(formData.get("imagenes") || "").trim();
  const origenListado = String(formData.get("origen_listado") || "propio").trim();
  const corredorNombre = String(formData.get("corredor_colaborador_nombre") || "").trim();
  const corredorEmpresa = String(formData.get("corredor_colaborador_empresa") || "").trim();
  const corredorContacto = String(formData.get("corredor_colaborador_contacto") || "").trim();
  const enlaceOriginal = String(formData.get("enlace_original") || "").trim();
  const permisoPublicar = formData.get("permiso_publicar_web") === "on";
  const permisoFotos = formData.get("permiso_usar_fotos") === "on";
  const notasInternas = String(formData.get("notas_internas") || "").trim();
  const formularioShowingActivo = formData.get("formulario_showing_activo") === "on";
  const fechaShowing = buildShowingDateTime(
    String(formData.get("fecha_showing_fecha") || "").trim(),
    String(formData.get("fecha_showing_hora") || "").trim()
  );
  const requierePrecalificacion = formData.get("requiere_precalificacion") === "on";
  const preguntaPersonalizada = String(formData.get("pregunta_personalizada") || "").trim();
  const tienePlacasSolares = formData.get("tiene_placas_solares") === "on";
  const cantidadPlacas = parsePositiveNumber(String(formData.get("cantidad_placas") || "0").trim() || "0");
  const placasEnLease = formData.get("placas_en_lease") === "on";
  const aceptaCdbg = formData.get("acepta_cdbg") === "on";
  const notasCompradores = String(formData.get("notas_compradores") || "").trim();

  if (!id) {
    return { error: "No se encontró la propiedad a editar." };
  }

  const slug = normalizeSlug(slugRaw);

  if (
    !slug ||
    !titulo ||
    !descripcion ||
    !municipio ||
    !tipoNegocio ||
    !tipoPropiedad ||
    !estado
  ) {
    return { error: "Completa todos los campos obligatorios." };
  }

  if (!municipiosValidos.has(municipio as never)) {
    return { error: "Selecciona un municipio válido." };
  }

  const sectorComunidad = normalizeSectorForMunicipio(municipio, sectorComunidadRaw);

  if (!tiposNegocioValidos.has(tipoNegocio as never)) {
    return { error: "Selecciona un tipo de negocio válido." };
  }

  if (!tiposPropiedadValidos.has(tipoPropiedad as never)) {
    return { error: "Selecciona un tipo de propiedad válido." };
  }

  if (!estadosValidos.has(estado as never)) {
    return { error: "Selecciona un estado válido." };
  }

  if (!origenListadoLegacyValidos.has(origenListado as never)) {
    return { error: "Selecciona un origen de listado válido." };
  }

  const propiedadActualRows = await sql<{
    origen_listado: string;
    estado: string;
  }[]>`
    SELECT origen_listado, estado
    FROM propiedades
    WHERE id = ${id}
    LIMIT 1
  `;
  const propiedadActual = propiedadActualRows[0];
  const origenActual = propiedadActual?.origen_listado;
  const estadoActual = propiedadActual?.estado;

  if (!origenActual) {
    return { error: "No se encontró la propiedad a editar." };
  }

  if (origenListado === "externo" && origenActual !== "externo") {
    return {
      error:
        "Externo / referencia es un origen legado y no está disponible para este listado.",
    };
  }

  if (origenListado === "co_broke" && !corredorNombre) {
    return { error: "El nombre del corredor colaborador es requerido para co-broke." };
  }

  const precio = estado === "coming_soon" && !precioRaw
    ? 0
    : parsePositiveNumber(precioRaw);
  const habitaciones = parsePositiveNumber(habitacionesRaw || "0");
  const banos = parsePositiveNumber(banosRaw || "0");
  const estacionamientos = parsePositiveNumber(estacionamientosRaw || "0");
  const metrosCuadrados = parsePositiveNumber(metrosRaw || "0");

  if (precio === null || (estado !== "coming_soon" && !precioRaw)) {
    return { error: "El precio debe ser un número válido." };
  }

  if (cantidadPlacas === null) {
    return { error: "La cantidad de placas debe ser un numero valido." };
  }

  if (formularioShowingActivo && !fechaShowing) {
    return { error: "Indica fecha y hora para activar el formulario de showing." };
  }

  if (
    habitaciones === null ||
    banos === null ||
    estacionamientos === null ||
    metrosCuadrados === null
  ) {
    return {
      error:
        "Habitaciones, baños, estacionamientos y metros deben ser válidos.",
    };
  }

  const slugExistente = await sql`
    SELECT 1
    FROM propiedades
    WHERE slug = ${slug}
      AND id <> ${id}
    LIMIT 1
  `;

  if (slugExistente.length > 0) {
    return { error: "Ya existe otra propiedad con ese slug." };
  }

  const imagenes = imagenesRaw
    .split(",")
    .map((img) => img.trim())
    .filter(Boolean);

  try {
    const actualizadas = await sql<{ id: string }[]>`
      UPDATE propiedades
      SET
        slug = ${slug},
        titulo = ${titulo},
        descripcion = ${descripcion},
        municipio = ${municipio},
        sector_comunidad = ${sectorComunidad || null},
        precio = ${precio},
        tipo_negocio = ${tipoNegocio},
        tipo_propiedad = ${tipoPropiedad},
        habitaciones = ${habitaciones},
        banos = ${banos},
        estacionamientos = ${estacionamientos},
        metros_cuadrados = ${metrosCuadrados},
        estado = ${estado},
        destacado = ${destacado},
        origen_listado = ${origenListado},
        corredor_colaborador_nombre = ${corredorNombre || null},
        corredor_colaborador_empresa = ${corredorEmpresa || null},
        corredor_colaborador_contacto = ${corredorContacto || null},
        enlace_original = ${enlaceOriginal || null},
        permiso_publicar_web = ${permisoPublicar},
        permiso_usar_fotos = ${permisoFotos},
        notas_internas = ${notasInternas || null},
        formulario_showing_activo = ${formularioShowingActivo},
        fecha_showing = ${fechaShowing},
        requiere_precalificacion = ${requierePrecalificacion},
        pregunta_personalizada = ${preguntaPersonalizada || null},
        tiene_placas_solares = ${tienePlacasSolares},
        cantidad_placas = ${cantidadPlacas},
        placas_en_lease = ${placasEnLease},
        acepta_cdbg = ${aceptaCdbg},
        configuracion_formulario = ${sql.json({ notas_compradores: notasCompradores })}
      WHERE id = ${id}
      RETURNING id
    `;

    const actualizada = actualizadas[0];

    if (!actualizada) {
      return { error: "No se encontró la propiedad a editar." };
    }

    await sql`
      DELETE FROM propiedad_imagenes
      WHERE propiedad_id = ${id}
    `;

    for (let i = 0; i < imagenes.length; i++) {
      await sql`
        INSERT INTO propiedad_imagenes (propiedad_id, url, orden)
        VALUES (${id}, ${imagenes[i]}, ${i + 1})
      `;
    }

    console.info("PROPERTY STATUS TRANSITION CHECK:", {
      flow: "full_edit",
      propertyId: id,
      propertySlug: slug,
      propertyTitle: titulo,
      previousStatus: estadoActual,
      newStatus: estado,
    });

    if (estadoActual === "coming_soon" && estado === "disponible") {
      await notifyPriorityRegistrationsForAvailableProperty({
        propertyId: id,
        propertyTitle: titulo,
        propertySlug: slug,
      });
    }

    revalidatePath("/admin/propiedades");
    revalidatePath(`/admin/propiedades/${id}/editar`);
    revalidatePath("/listados");
    revalidatePath("/");
  } catch (error) {
    console.error("UPDATE PROPIEDAD ERROR:", error);
    return { error: "No se pudo actualizar la propiedad." };
  }

  redirect(`/admin/propiedades?ok=updated&id=${id}`);
}

export async function updatePropiedadEstadoAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get("id") || "").trim();
  const estado = String(formData.get("estado") || "").trim();

  if (!id) {
    throw new Error("No se encontró la propiedad.");
  }

  if (!estadosValidos.has(estado as never)) {
    throw new Error("Estado inválido.");
  }

  const propiedadActualRows = await sql<{
    estado: string;
    titulo: string;
    slug: string;
  }[]>`
    SELECT estado, titulo, slug
    FROM propiedades
    WHERE id = ${id}
    LIMIT 1
  `;
  const propiedadActual = propiedadActualRows[0];

  if (!propiedadActual) {
    throw new Error("No se encontrÃ³ la propiedad.");
  }

  await sql`
    UPDATE propiedades
    SET estado = ${estado}
    WHERE id = ${id}
  `;

  console.info("PROPERTY STATUS TRANSITION CHECK:", {
    flow: "inline_status",
    propertyId: id,
    propertySlug: propiedadActual.slug,
    propertyTitle: propiedadActual.titulo,
    previousStatus: propiedadActual.estado,
    newStatus: estado,
  });

  if (propiedadActual.estado === "coming_soon" && estado === "disponible") {
    await notifyPriorityRegistrationsForAvailableProperty({
      propertyId: id,
      propertyTitle: propiedadActual.titulo,
      propertySlug: propiedadActual.slug,
    });
  }

  revalidatePath("/admin/propiedades");
  revalidatePath("/listados");
  revalidatePath("/");

   return { ok: true };
}

export async function deletePropiedadAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get("id") || "").trim();
  const confirmacion = String(formData.get("confirmacion") || "").trim();

  if (!id) {
    throw new Error("No se encontró la propiedad.");
  }

  if (confirmacion !== "BORRAR") {
    throw new Error("Confirmación inválida.");
  }

  await sql`
    DELETE FROM propiedades
    WHERE id = ${id}
  `;
  
  revalidatePath("/admin/propiedades");
  revalidatePath("/listados");
  revalidatePath("/");
  
  return {ok: true};
}

export async function toggleDestacadoAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get("id") || "").trim();
  const destacado = formData.get("destacado") === "true";

  if (!id) {
    throw new Error("No se encontró la propiedad.");
  }

  await sql`
    UPDATE propiedades
    SET destacado = ${destacado}
    WHERE id = ${id}
  `;

  revalidatePath("/admin/propiedades");
  revalidatePath("/listados");
  revalidatePath("/");

  return { ok: true };
}
