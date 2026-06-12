"use server";

import { redirect } from "next/navigation";
import { sql } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getAdminSessionUser } from "@/lib/admin/auth";

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
    const rows = await sql<{ id: string }[]>`
      INSERT INTO testimonios (
        nombre,
        texto,
        ubicacion,
        foto_url,
        tipo,
        activo,
        destacado,
        orden
      ) VALUES (
        ${nombre},
        ${texto},
        ${ubicacion || null},
        ${fotoUrl || null},
        ${tipo},
        ${activo},
        ${destacado},
        ${orden}
      )
      RETURNING id
    `;

    insertadoId = rows[0].id;

    revalidatePath("/admin/testimonios");
    revalidatePath("/");
    revalidatePath("/testimonios");
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
    const rows = await sql<{ id: string }[]>`
      UPDATE testimonios
      SET
        nombre = ${nombre},
        texto = ${texto},
        ubicacion = ${ubicacion || null},
        foto_url = ${fotoUrl || null},
        tipo = ${tipo},
        activo = ${activo},
        destacado = ${destacado},
        orden = ${orden}
      WHERE id = ${id}
      RETURNING id
    `;

    if (!rows[0]) {
      return { error: "No se encontró el testimonio." };
    }

    revalidatePath("/admin/testimonios");
    revalidatePath(`/admin/testimonios/${id}/editar`);
    revalidatePath("/");
    revalidatePath("/testimonios");
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
