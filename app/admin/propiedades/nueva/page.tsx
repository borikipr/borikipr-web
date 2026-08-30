import { requireModuleAccess } from "@/lib/admin/access-context";
import { sql } from "@/lib/db";
import { listEligibleListingResponsibleProfessionals } from "@/lib/admin/listing-responsibility";
import NuevaPropiedadForm from "./NuevaPropiedadForm";

export default async function NuevaPropiedadPage() {
  await requireModuleAccess("properties", "manage");
  const eligibleProfessionals = await listEligibleListingResponsibleProfessionals(sql);
  return <NuevaPropiedadForm eligibleProfessionals={eligibleProfessionals} />;
}
