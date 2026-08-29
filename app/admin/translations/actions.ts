"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/auth";
import { requireModuleAccess } from "@/lib/admin/access-context";
import { sql } from "@/lib/db";
import {
  createTranslationAdminService,
  TranslationAdminConflictError,
  TranslationAdminValidationError,
} from "@/lib/i18n/translations/admin-service";
import { createPostgresTranslationDatabase } from "@/lib/i18n/translations/repository";
import type { TranslationEntityType } from "@/lib/i18n/translations/types";
import { invalidateEnglishPublicTranslationPaths } from "@/lib/i18n/translations/public-revalidation";

export type TranslationAdminActionState = {
  ok: boolean;
  message: string;
};

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function parseCommon(formData: FormData) {
  const entityType = text(formData, "entityType");
  if (entityType !== "property" && entityType !== "testimonial") {
    throw new TranslationAdminValidationError("Tipo de contenido inválido.");
  }
  return {
    translationId: text(formData, "translationId"),
    entityType: entityType as TranslationEntityType,
    ownerId: text(formData, "ownerId"),
    expectedSourceHash: text(formData, "expectedSourceHash"),
    expectedLockVersion: Number(text(formData, "expectedLockVersion")),
  };
}

function adminPath(entityType: TranslationEntityType, ownerId: string) {
  return entityType === "property"
    ? `/admin/propiedades/${ownerId}/editar`
    : `/admin/testimonios/${ownerId}/editar`;
}

async function execute(
  formData: FormData,
  mutation: (
    service: ReturnType<typeof createTranslationAdminService>,
    input: ReturnType<typeof parseCommon> & { actorAdminId: string }
  ) => Promise<unknown>,
  successMessage: string
): Promise<TranslationAdminActionState> {
  const session = await getAdminSession();
  if (!session) return { ok: false, message: "Tu sesión de administrador expiró." };
  try {
    const common = parseCommon(formData);
    await requireModuleAccess(common.entityType === "property" ? "properties" : "testimonials", "manage");
    const service = createTranslationAdminService(
      createPostgresTranslationDatabase(sql)
    );
    await mutation(service, { ...common, actorAdminId: session.id });
    revalidatePath(adminPath(common.entityType, common.ownerId));
    const propertySlug = common.entityType === "property"
      ? (await sql<{ slug: string }[]>`
          SELECT slug FROM public.propiedades WHERE id = ${common.ownerId}::uuid
        `)[0]?.slug ?? null
      : null;
    try {
      await invalidateEnglishPublicTranslationPaths({
        target: {
          entityType: common.entityType,
          ownerId: common.ownerId,
          propertySlug,
        },
        revalidate: revalidatePath,
      });
    } catch (error) {
      console.error("translation_public_revalidation_failed", {
        entityType: common.entityType,
        errorClass: error instanceof Error ? error.name : "UnknownError",
      });
    }
    return { ok: true, message: successMessage };
  } catch (error) {
    if (
      error instanceof TranslationAdminConflictError ||
      error instanceof TranslationAdminValidationError
    ) {
      return { ok: false, message: error.message };
    }
    console.error("translation_admin_mutation_failed", {
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return { ok: false, message: "No se pudo guardar el cambio. Intenta nuevamente." };
  }
}

export async function saveManualTranslation(
  _state: TranslationAdminActionState,
  formData: FormData
) {
  return execute(
    formData,
    (service, input) => service.manualEdit({
      ...input,
      translatedValue: text(formData, "translatedValue"),
    }),
    "La traducción manual se guardó y quedó protegida."
  );
}

export async function markTranslationReviewed(
  _state: TranslationAdminActionState,
  formData: FormData
) {
  return execute(formData, (service, input) => service.markReviewed(input),
    "La traducción quedó marcada como revisada y protegida.");
}

export async function confirmTranslationStillApplies(
  _state: TranslationAdminActionState,
  formData: FormData
) {
  return execute(formData, (service, input) => service.confirmStillApplies(input),
    "La traducción se confirmó para la fuente actual.");
}

export async function authorizeTranslationRegeneration(
  _state: TranslationAdminActionState,
  formData: FormData
) {
  return execute(formData, (service, input) => service.authorizeRegeneration(input),
    "Regeneración autorizada. La traducción está pendiente de procesamiento.");
}

export async function restoreTranslationRevision(
  _state: TranslationAdminActionState,
  formData: FormData
) {
  return execute(formData, (service, input) => service.restore({
    ...input,
    eventId: text(formData, "eventId"),
  }), "La versión histórica se restauró como traducción manual protegida.");
}
