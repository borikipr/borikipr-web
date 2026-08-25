"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { revalidatePath, revalidateTag } from "next/cache";
import { PUBLIC_TESTIMONIALS_CACHE_TAG } from "@/lib/queries/testimonios";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { syncTestimonialTranslationIntent } from "@/lib/i18n/translations/source-intents";
import { invalidateEnglishPublicTranslationPaths } from "@/lib/i18n/translations/public-revalidation";

async function revalidateEnglishTestimonial(testimonialId: string) {
  try {
    await invalidateEnglishPublicTranslationPaths({
      target: { entityType: "testimonial", ownerId: testimonialId },
      revalidate: revalidatePath,
    });
  } catch (error) {
    console.error("translation_public_revalidation_failed", {
      entityType: "testimonial",
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
  }
}

function revalidatePublicTestimonials() {
  revalidateTag(PUBLIC_TESTIMONIALS_CACHE_TAG, "max");
}

export type CreateTestimonioState = {
  error: string;
};

export type UpdateTestimonioState = {
  error: string;
};

const tiposValidos = new Set(["comprador", "vendedor"]);

function parseOrden(value: string) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

async function requireAdminSession() {
  const user = await getAdminSessionUser();
  if (!user) {
    throw new Error("No autorizado.");
  }
}

export async function createTestimonioAction(
  _prevState: CreateTestimonioState,
  formData: FormData
): Promise<CreateTestimonioState> {
  await requireAdminSession();

  const nombre = String(formData.get("nombre") || "").trim();
  const texto = String(formData.get("texto") || "").trim();
  const ubicacion = String(formData.get("ubicacion") || "").trim();
  const fotoUrl = String(formData.get("foto_url") || "").trim();
  const tipo = String(formData.get("tipo") || "").trim();
  const ordenRaw = String(formData.get("orden") || "").trim();
  const activo = formData.get("activo") === "on";
  const destacado = formData.get("destacado") === "on";

  if (!nombre || !texto) {
    return { error: "Nombre y testimonio son obligatorios." };
  }

  if (!tiposValidos.has(tipo)) {
    return { error: "Selecciona un tipo válido." };
  }

  const orden = parseOrden(ordenRaw || "0");

  if (orden === null) {
    return { error: "El orden debe ser un número válido." };
  }

  let insertadoId = "";

  try {
    insertadoId = await sql.begin(async (transaction) => {
      const rows = await transaction.unsafe<{ id: string }[]>(
        `INSERT INTO public.testimonios (
        nombre,
        texto,
        ubicacion,
        foto_url,
        tipo,
        activo,
        destacado,
        orden
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id::text`,
        [
          nombre,
          texto,
          ubicacion || null,
          fotoUrl || null,
          tipo,
          activo,
          destacado,
          orden,
        ]
      );
      const testimonial = rows[0];
      if (!testimonial) throw new Error("Testimonial was not created.");
      await syncTestimonialTranslationIntent(transaction, {
        testimonialId: testimonial.id,
        body: texto,
        active: activo,
      });
      return testimonial.id;
    });

    revalidatePath("/admin/testimonios");
    revalidatePublicTestimonials();
    revalidatePath("/");
    revalidatePath("/testimonios");
    await revalidateEnglishTestimonial(insertadoId);
  } catch (error) {
    console.error("CREATE TESTIMONIO ERROR:", error);
    return { error: "No se pudo crear el testimonio." };
  }

  redirect(`/admin/testimonios?ok=created&id=${insertadoId}`);
}

export async function updateTestimonioAction(
  _prevState: UpdateTestimonioState,
  formData: FormData
): Promise<UpdateTestimonioState> {
  await requireAdminSession();

  const id = String(formData.get("id") || "").trim();
  const nombre = String(formData.get("nombre") || "").trim();
  const texto = String(formData.get("texto") || "").trim();
  const ubicacion = String(formData.get("ubicacion") || "").trim();
  const fotoUrl = String(formData.get("foto_url") || "").trim();
  const tipo = String(formData.get("tipo") || "").trim();
  const ordenRaw = String(formData.get("orden") || "").trim();
  const activo = formData.get("activo") === "on";
  const destacado = formData.get("destacado") === "on";

  if (!id) {
    return { error: "No se encontró el testimonio." };
  }

  if (!nombre || !texto) {
    return { error: "Nombre y testimonio son obligatorios." };
  }

  if (!tiposValidos.has(tipo)) {
    return { error: "Selecciona un tipo válido." };
  }

  const orden = parseOrden(ordenRaw || "0");

  if (orden === null) {
    return { error: "El orden debe ser un número válido." };
  }

  try {
    const rows = await sql.begin(async (transaction) => {
      const locked = await transaction.unsafe<{ id: string; texto: string }[]>(
        `SELECT id::text, texto
           FROM public.testimonios
          WHERE id = $1::uuid
          FOR UPDATE`,
        [id]
      );
      if (!locked[0]) return [];
      const updated = await transaction.unsafe<{ id: string }[]>(
        `UPDATE public.testimonios
            SET nombre = $2,
                texto = $3,
                ubicacion = $4,
                foto_url = $5,
                tipo = $6,
                activo = $7,
                destacado = $8,
                orden = $9
          WHERE id = $1::uuid
          RETURNING id::text`,
        [
          id,
          nombre,
          texto,
          ubicacion || null,
          fotoUrl || null,
          tipo,
          activo,
          destacado,
          orden,
        ]
      );
      await syncTestimonialTranslationIntent(transaction, {
        testimonialId: id,
        body: texto,
        active: activo,
      });
      return updated;
    });

    if (!rows[0]) {
      return { error: "No se encontró el testimonio." };
    }

    revalidatePath("/admin/testimonios");
    revalidatePublicTestimonials();
    revalidatePath(`/admin/testimonios/${id}/editar`);
    revalidatePath("/");
    revalidatePath("/testimonios");
    await revalidateEnglishTestimonial(id);
  } catch (error) {
    console.error("UPDATE TESTIMONIO ERROR:", error);
    return { error: "No se pudo actualizar el testimonio." };
  }

  redirect(`/admin/testimonios?ok=updated&id=${id}`);
}

export async function updateTestimonioActivoAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get("id") || "").trim();
  const activo = String(formData.get("activo") || "").trim() === "true";

  if (!id) {
    throw new Error("No se encontró el testimonio.");
  }

  await sql`
    UPDATE testimonios
    SET activo = ${activo}
    WHERE id = ${id}
  `;

  revalidatePath("/admin/testimonios");
  revalidatePublicTestimonials();
  revalidatePath("/");
  revalidatePath("/testimonios");

  return { ok: true };
}

export async function deleteTestimonioAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get("id") || "").trim();
  const confirmacion = String(formData.get("confirmacion") || "").trim();

  if (!id) {
    throw new Error("No se encontró el testimonio.");
  }

  if (confirmacion !== "BORRAR") {
    throw new Error("Confirmación inválida.");
  }

  await sql`
    DELETE FROM testimonios
    WHERE id = ${id}
  `;

  revalidatePath("/admin/testimonios");
  revalidatePublicTestimonials();
  revalidatePath("/");
  revalidatePath("/testimonios");

  return { ok: true };
}
export async function toggleTestimonioDestacadoAction(formData: FormData) {
  await requireAdminSession();

  const id = String(formData.get("id") || "").trim();
  const destacado = formData.get("destacado") === "true";

  if (!id) {
    throw new Error("No se encontró el testimonio.");
  }

  await sql`
    UPDATE testimonios
    SET destacado = ${destacado}
    WHERE id = ${id}
  `;

  revalidatePath("/admin/testimonios");
  revalidatePublicTestimonials();
  revalidatePath("/");
  revalidatePath("/testimonios");

  return { ok: true };
}

export async function getSiguienteOrdenAction() {
  await requireAdminSession();

  const rows = await sql<{ max_orden: number }[]>`
    SELECT COALESCE(MAX(orden), -1) + 1 as max_orden
    FROM testimonios
  `;
  return rows[0]?.max_orden ?? 0;
}
