import { sql } from "@/lib/db";
import {
  collectAvailabilityRegistrationsInTransaction,
  deliverAvailabilityNotificationIntents,
  queueAvailabilityNotificationIntentsInTransaction,
} from "@/lib/property-availability-enqueue";

type PropertyRow = {
  id: string;
  slug: string;
  titulo: string;
  estado: string;
};

export async function updatePropertyStatusWithAvailabilityQueue({
  propertyId,
  newStatus,
}: {
  propertyId: string;
  newStatus: string;
}) {
  const transition = await sql.begin(async (transaction) => {
    const rows = await transaction.unsafe<PropertyRow[]>(
      `SELECT id::text, slug, titulo, estado
         FROM public.propiedades
        WHERE id = $1::uuid
        LIMIT 1
        FOR UPDATE`,
      [propertyId]
    );
    const property = rows[0];
    if (!property) throw new Error("Property not found.");

    await transaction.unsafe(
      `UPDATE public.propiedades SET estado = $1 WHERE id = $2::uuid`,
      [newStatus, propertyId]
    );

    const isAvailabilityTransition =
      property.estado === "coming_soon" && newStatus === "disponible";
    const registrations = isAvailabilityTransition
      ? await collectAvailabilityRegistrationsInTransaction(
          transaction,
          property.id
        )
      : null;
    const intent = registrations
      ? await queueAvailabilityNotificationIntentsInTransaction(
          transaction,
          { id: property.id, slug: property.slug, title: property.titulo },
          registrations
        )
      : null;

    return {
      previousStatus: property.estado,
      newStatus,
      intent,
      property: {
        id: property.id,
        slug: property.slug,
        title: property.titulo,
      },
    };
  });
  const delivery = transition.intent
    ? await deliverAvailabilityNotificationIntents(transition.intent.dedupeKeys)
    : null;
  return {
    previousStatus: transition.previousStatus,
    newStatus: transition.newStatus,
    intent: transition.intent,
    queue: delivery,
  };
}
