"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { municipiosPR } from "@/data/municipios";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { normalizeSectorForMunicipio } from "@/lib/puerto-rico-sectores";
import {
  collectAvailabilityRegistrationsInTransaction,
  deliverAvailabilityNotifications,
} from "@/lib/property-availability-enqueue";
import { updatePropertyStatusWithAvailabilityQueue } from "@/lib/postgres-property-availability";

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

async function requireAdminSession() {
  const user = await getAdminSessionUser();
  if (!user) {
    throw new Error("No autorizado.");
  }
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
  const preguntaPersonalizada = "";
  const tienePlacasSolares = false;
  const cantidadPlacas = 0;
  const placasEnLease = formData.get("placas_en_lease") === "on";
  const openHouseSolarQuestionEnabled =
    formData.get("open_house_solar_question_enabled") === "on";
  const aceptaCdbg = false;
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
    return { error: "Indica fecha y hora para activar el formulario de Open House." };
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
        open_house_solar_question_enabled,
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
        ${openHouseSolarQuestionEnabled},
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
  const placasEnLease = formData.get("placas_en_lease") === "on";
  const openHouseSolarQuestionEnabled =
    formData.get("open_house_solar_question_enabled") === "on";
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
    pregunta_personalizada: string | null;
    acepta_cdbg: boolean | null;
    tiene_placas_solares: boolean | null;
    cantidad_placas: number | null;
    configuracion_formulario: Record<string, unknown> | null;
  }[]>`
    SELECT
      origen_listado,
      pregunta_personalizada,
      acepta_cdbg,
      tiene_placas_solares,
      cantidad_placas,
      configuracion_formulario
    FROM propiedades
    WHERE id = ${id}
    LIMIT 1
  `;
  const propiedadActual = propiedadActualRows[0];
  const origenActual = propiedadActual?.origen_listado;

  if (!origenActual) {
    return { error: "No se encontró la propiedad a editar." };
  }

  const preguntaPersonalizada =
    propiedadActual.pregunta_personalizada || "";
  const aceptaCdbg = propiedadActual.acepta_cdbg === true;
  const tienePlacasSolares =
    propiedadActual.tiene_placas_solares === true;
  const cantidadPlacas = propiedadActual.cantidad_placas ?? 0;

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
    return { error: "Indica fecha y hora para activar el formulario de Open House." };
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
    const transition = await sql.begin(async (transaction) => {
      const lockedRows = await transaction.unsafe<{ estado: string }[]>(
        `SELECT estado
           FROM public.propiedades
          WHERE id = $1::uuid
          LIMIT 1
          FOR UPDATE`,
        [id]
      );
      const locked = lockedRows[0];
      if (!locked) throw new Error("Property not found.");

      const actualizadas = await transaction.unsafe<{ id: string }[]>(
        `UPDATE public.propiedades
            SET slug = $1,
                titulo = $2,
                descripcion = $3,
                municipio = $4,
                sector_comunidad = $5,
                precio = $6,
                tipo_negocio = $7,
                tipo_propiedad = $8,
                habitaciones = $9,
                banos = $10,
                estacionamientos = $11,
                metros_cuadrados = $12,
                estado = $13,
                destacado = $14,
                origen_listado = $15,
                corredor_colaborador_nombre = $16,
                corredor_colaborador_empresa = $17,
                corredor_colaborador_contacto = $18,
                enlace_original = $19,
                permiso_publicar_web = $20,
                permiso_usar_fotos = $21,
                notas_internas = $22,
                formulario_showing_activo = $23,
                fecha_showing = $24,
                requiere_precalificacion = $25,
                pregunta_personalizada = $26,
                tiene_placas_solares = $27,
                cantidad_placas = $28,
                placas_en_lease = $29,
                open_house_solar_question_enabled = $30,
                acepta_cdbg = $31,
                configuracion_formulario = $32::jsonb
          WHERE id = $33::uuid
          RETURNING id::text`,
        [
          slug,
          titulo,
          descripcion,
          municipio,
          sectorComunidad || null,
          precio,
          tipoNegocio,
          tipoPropiedad,
          habitaciones,
          banos,
          estacionamientos,
          metrosCuadrados,
          estado,
          destacado,
          origenListado,
          corredorNombre || null,
          corredorEmpresa || null,
          corredorContacto || null,
          enlaceOriginal || null,
          permisoPublicar,
          permisoFotos,
          notasInternas || null,
          formularioShowingActivo,
          fechaShowing,
          requierePrecalificacion,
          preguntaPersonalizada || null,
          tienePlacasSolares,
          cantidadPlacas,
          placasEnLease,
          openHouseSolarQuestionEnabled,
          aceptaCdbg,
          JSON.stringify({
            ...(propiedadActual.configuracion_formulario || {}),
            notas_compradores: notasCompradores,
          }),
          id,
        ]
      );
      if (!actualizadas[0]) throw new Error("Property not found.");

      await transaction.unsafe(
        "DELETE FROM public.propiedad_imagenes WHERE propiedad_id = $1::uuid",
        [id]
      );
      for (let i = 0; i < imagenes.length; i++) {
        await transaction.unsafe(
          `INSERT INTO public.propiedad_imagenes (propiedad_id, url, orden)
           VALUES ($1::uuid, $2, $3)`,
          [id, imagenes[i], i + 1]
        );
      }

      const registrations =
        locked.estado === "coming_soon" && estado === "disponible"
          ? await collectAvailabilityRegistrationsInTransaction(transaction, id)
          : null;
      return { previousStatus: locked.estado, registrations };
    });

    const availabilityDelivery = transition.registrations
      ? await deliverAvailabilityNotifications(
          { id, slug, title: titulo },
          transition.registrations
        )
      : null;

    console.info("PROPERTY STATUS TRANSITION", {
      flow: "full_edit",
      propertyId: id,
      previousStatus: transition.previousStatus,
      newStatus: estado,
      availabilityDelivery,
    });

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

  const transition = await updatePropertyStatusWithAvailabilityQueue({
    propertyId: id,
    newStatus: estado,
  });

  console.info("PROPERTY STATUS TRANSITION", {
    flow: "inline_status",
    propertyId: id,
    previousStatus: transition.previousStatus,
    newStatus: estado,
    availabilityQueue: transition.queue,
  });

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
