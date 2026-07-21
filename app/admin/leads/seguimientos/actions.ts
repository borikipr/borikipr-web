"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { markLeadContacted, setLeadFollowUp } from "@/lib/admin/lead-follow-up-mutations";
import { sql } from "@/lib/db";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const username = await getAdminSessionUser();
  if (!username) throw new Error("No autorizado.");
  return username;
}

function requiredUuid(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (!UUID_PATTERN.test(value)) throw new Error("Identificador inválido.");
  return value;
}

function parsePuertoRicoDateTime(formData: FormData) {
  const raw = String(formData.get("next_follow_up_at") ?? "").trim();
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) throw new Error("Fecha inválida.");
  const parsed = new Date(`${raw}:00-04:00`);
  if (Number.isNaN(parsed.getTime())) throw new Error("Fecha inválida.");
  return parsed.toISOString();
}

function revalidateLeadViews(leadId: string) {
  revalidatePath("/admin/leads");
  revalidatePath("/admin/leads/seguimientos");
  revalidatePath(`/admin/leads/${leadId}`);
}

function failureMessage(error: unknown) {
  if (error instanceof Error && [
    "Fecha inválida.",
    "Identificador inválido.",
    "El lead no está disponible para seguimiento.",
  ].includes(error.message)) return error.message;
  return "No se pudo guardar el cambio. Intenta nuevamente.";
}

export async function setFollowUpFromCenterAction(formData: FormData) {
  let leadId = "";
  try {
    const username = await requireAdmin();
    leadId = requiredUuid(formData, "lead_id");
    const operationKey = requiredUuid(formData, "operation_key");
    const nextAt = parsePuertoRicoDateTime(formData);
    await sql.begin((transaction) => setLeadFollowUp(transaction, {
      leadId, nextAt, operationKey, username, actionableOnly: true,
    }));
    revalidateLeadViews(leadId);
  } catch (error) {
    redirect(`/admin/leads/seguimientos?error=${encodeURIComponent(failureMessage(error))}`);
  }
  redirect("/admin/leads/seguimientos?ok=Seguimiento%20actualizado");
}

export async function markContactedFromCenterAction(formData: FormData) {
  let leadId = "";
  try {
    const username = await requireAdmin();
    leadId = requiredUuid(formData, "lead_id");
    const operationKey = requiredUuid(formData, "operation_key");
    await sql.begin((transaction) => markLeadContacted(transaction, {
      leadId, operationKey, username,
    }));
    revalidateLeadViews(leadId);
  } catch (error) {
    redirect(`/admin/leads/seguimientos?error=${encodeURIComponent(failureMessage(error))}`);
  }
  redirect("/admin/leads/seguimientos?ok=Contacto%20registrado");
}
