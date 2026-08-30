"use server";
import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/admin/auth";
import { requireModuleAccess } from "@/lib/admin/access-context";
import { sql } from "@/lib/db";
import { createPostgresSignatureDatabase } from "@/lib/signatures/domain/database";
import { createSignatureProductRepository } from "@/lib/signatures/productization";

export async function saveBrokerSettingsAction(formData:FormData) {
  const session=await getAdminSession();
  if(!session) throw new Error("unauthorized");
  await requireModuleAccess("signatures", "manage");
  await createSignatureProductRepository(createPostgresSignatureDatabase(sql)).saveBrokerSettings({
    brokerAdminUserId:String(formData.get("brokerAdminUserId")??""),actorAdminId:session.id,
    confirmationPhrase:String(formData.get("confirmationPhrase")??""),
  });
  revalidatePath("/admin/signatures/configuracion");
  revalidatePath("/admin/signatures");
}
