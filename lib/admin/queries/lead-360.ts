import { sql } from "@/lib/db";
import {
  CANONICAL_LEAD_SOURCE_LABELS,
  type CanonicalLeadSourceType,
} from "@/lib/admin/queries/canonical-leads";

export const LEAD_STATUS_LABELS = {
  new: "Nuevo",
  active: "Activo",
  do_not_contact: "No contactar",
  archived: "Archivado",
  merged: "Fusionado",
} as const;

export const LEAD_RELATIONSHIP_LABELS = {
  family: "Familiar",
  primary_buyer: "Comprador principal",
  co_buyer: "Co-comprador",
  prequalified_person: "Persona precalificada",
  representative_contact: "Representante o contacto",
  other: "Otra relación",
} as const;

export type LeadStatus = keyof typeof LEAD_STATUS_LABELS;
export type LeadRelationshipType = keyof typeof LEAD_RELATIONSHIP_LABELS;

export type SqlQuery = { text: string; values: unknown[] };

export type Lead360Identity = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: LeadStatus;
  identityStatus: string;
  firstSeenAt: string;
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
  nextFollowUpAt: string | null;
};

export type Lead360Interaction = {
  id: string;
  sourceType: CanonicalLeadSourceType;
  sourceLabel: string;
  createdAt: string;
  propertyId: string | null;
  propertyTitle: string | null;
  propertySlug: string | null;
  details: Record<string, unknown>;
};

export type Lead360SharedContact = {
  id: string;
  name: string;
  emailMatch: boolean;
  phoneMatch: boolean;
  reviewDecision: "keep_separate" | "same_person" | null;
};

export type Lead360Relationship = {
  id: string;
  relatedLeadId: string;
  relatedLeadName: string;
  type: LeadRelationshipType;
  createdAt: string;
  updatedAt: string;
};

export type Lead360Note = {
  id: string;
  body: string;
  authorUsername: string;
  createdAt: string;
};

export type Lead360ManagementEvent = {
  id: string;
  type: string;
  data: Record<string, unknown>;
  actorUsername: string;
  createdAt: string;
};

export type Lead360EmailSummary = {
  status: string;
  count: number;
  lastSentAt: string | null;
  lastUpdatedAt: string;
};

export type Lead360Detail = {
  identity: Lead360Identity;
  interactions: Lead360Interaction[];
  sharedContacts: Lead360SharedContact[];
  relationships: Lead360Relationship[];
  notes: Lead360Note[];
  managementEvents: Lead360ManagementEvent[];
  emailSummary: Lead360EmailSummary[];
};

export function buildLead360IdentityQuery(leadId: string): SqlQuery {
  return {
    text: `SELECT
      id::text,
      name,
      email_original AS email,
      phone_original AS phone,
      status,
      identity_status,
      first_seen_at,
      last_activity_at,
      created_at,
      updated_at,
      next_follow_up_at
    FROM public.leads
    WHERE id = $1::uuid
      AND merged_into_lead_id IS NULL`,
    values: [leadId],
  };
}

export function buildLead360InteractionsQuery(leadId: string): SqlQuery {
  return {
    text: `SELECT * FROM (
      SELECT
        pr.id::text,
        'priority_registration'::text AS source_type,
        pr.created_at,
        pr.property_id::text AS property_id,
        pr.property_title,
        pr.property_slug,
        jsonb_strip_nulls(jsonb_build_object(
          'purchase_type', pr.purchase_type,
          'purchase_other', pr.purchase_other,
          'prequalified_status', pr.prequalified_status,
          'search_range', pr.search_range,
          'property_size', pr.property_size,
          'wants_visit', pr.wants_visit,
          'additional_info', pr.additional_info
        )) AS details
      FROM public.property_priority_registrations pr
      WHERE pr.lead_id = $1::uuid

      UNION ALL

      SELECT
        pbp.id::text,
        'property_buyer_profile'::text,
        pbp.created_at,
        pbp.property_id::text,
        p.titulo,
        p.slug,
        jsonb_strip_nulls(jsonb_build_object(
          'purchase_method', pbp.purchase_method,
          'purchase_method_other', pbp.purchase_method_other,
          'financial_institution', pbp.financial_institution,
          'closing_funds', pbp.closing_funds,
          'solar_contract_acceptance', pbp.solar_contract_acceptance,
          'comments', pbp.comments,
          'document_type', pbp.document_type,
          'document_original_name', pbp.document_original_name,
          'document_content_type', pbp.document_content_type,
          'document_size_bytes', pbp.document_size_bytes,
          'document_status', pbp.document_status
        ))
      FROM public.property_buyer_profiles pbp
      INNER JOIN public.propiedades p ON p.id = pbp.property_id
      WHERE pbp.lead_id = $1::uuid

      UNION ALL

      SELECT
        bti.id::text,
        'buyer_tenant_inquiry'::text,
        bti.created_at,
        NULL::text,
        NULL::text,
        NULL::text,
        jsonb_strip_nulls(jsonb_build_object(
          'primary_interest', bti.primary_interest,
          'purchase_qualification', bti.purchase_qualification,
          'budget', bti.budget,
          'municipalities', bti.municipalities,
          'property_types', bti.property_types,
          'bedrooms', bti.bedrooms,
          'bathrooms', bti.bathrooms,
          'comments', bti.comments
        ))
      FROM public.buyer_tenant_inquiries bti
      WHERE bti.lead_id = $1::uuid

      UNION ALL

      SELECT
        sli.id::text,
        'seller_landlord_inquiry'::text,
        sli.created_at,
        NULL::text,
        NULL::text,
        NULL::text,
        jsonb_strip_nulls(jsonb_build_object(
          'property_type', sli.property_type,
          'location', sli.location,
          'primary_reason', sli.primary_reason,
          'comments', sli.comments
        ))
      FROM public.seller_landlord_inquiries sli
      WHERE sli.lead_id = $1::uuid

      UNION ALL

      SELECT
        cp.id::text,
        'open_house_registration'::text,
        cp.created_at,
        cp.propiedad_id::text,
        p.titulo,
        p.slug,
        jsonb_strip_nulls(jsonb_build_object(
          'purchase_method', cp.metodo_compra,
          'closing_funds', cp.fondos_gastos_cierre,
          'working_with_broker', cp.trabajando_con_corredor,
          'broker_name', cp.nombre_corredor,
          'broker_phone', cp.telefono_corredor,
          'visit_availability', cp.disponibilidad_visita,
          'showing_at', cp.showing_at,
          'showing_event_key', cp.showing_event_key,
          'prequalification_document_status', cp.carta_precalificacion_status,
          'proof_of_funds_status', cp.evidencia_fondos_status,
          'custom_answers', cp.respuestas_personalizadas
        ))
      FROM public.consultas_propiedad cp
      INNER JOIN public.propiedades p ON p.id = cp.propiedad_id
      WHERE cp.lead_id = $1::uuid
    ) interactions
    ORDER BY created_at DESC, source_type ASC, id DESC`,
    values: [leadId],
  };
}

export function buildLead360SharedContactsQuery(leadId: string): SqlQuery {
  return {
    text: `WITH target AS (
      SELECT id, email_normalized, phone_normalized
      FROM public.leads
      WHERE id = $1::uuid
    )
    SELECT
      candidate.id::text,
      candidate.name,
      (
        target.email_normalized IS NOT NULL
        AND candidate.email_normalized = target.email_normalized
      ) AS email_match,
      (
        target.phone_normalized IS NOT NULL
        AND candidate.phone_normalized = target.phone_normalized
      ) AS phone_match,
      review.decision AS review_decision
    FROM target
    INNER JOIN public.leads candidate
      ON candidate.id <> target.id
     AND candidate.merged_into_lead_id IS NULL
     AND (
       (target.email_normalized IS NOT NULL AND candidate.email_normalized = target.email_normalized)
       OR (target.phone_normalized IS NOT NULL AND candidate.phone_normalized = target.phone_normalized)
     )
    LEFT JOIN public.lead_duplicate_reviews review
      ON LEAST(review.lead_id, review.compared_lead_id) = LEAST(target.id, candidate.id)
     AND GREATEST(review.lead_id, review.compared_lead_id) = GREATEST(target.id, candidate.id)
    ORDER BY lower(candidate.name), candidate.id`,
    values: [leadId],
  };
}

export function buildLead360RelationshipsQuery(leadId: string): SqlQuery {
  return {
    text: `SELECT
      relationship.id::text,
      CASE
        WHEN relationship.lead_id = $1::uuid THEN relationship.related_lead_id::text
        ELSE relationship.lead_id::text
      END AS related_lead_id,
      related.name AS related_lead_name,
      relationship.relationship_type,
      relationship.created_at,
      relationship.updated_at
    FROM public.lead_relationships relationship
    INNER JOIN public.leads related
      ON related.id = CASE
        WHEN relationship.lead_id = $1::uuid THEN relationship.related_lead_id
        ELSE relationship.lead_id
      END
    WHERE relationship.lead_id = $1::uuid
       OR relationship.related_lead_id = $1::uuid
    ORDER BY relationship.updated_at DESC, relationship.id DESC`,
    values: [leadId],
  };
}

export function buildLead360NotesQuery(leadId: string): SqlQuery {
  return {
    text: `SELECT id::text, body, author_username, created_at
      FROM public.lead_notes
      WHERE lead_id = $1::uuid
      ORDER BY created_at DESC, id DESC`,
    values: [leadId],
  };
}

export function buildLead360ManagementEventsQuery(leadId: string): SqlQuery {
  return {
    text: `SELECT id::text, event_type, event_data, actor_username, created_at
      FROM public.lead_management_events
      WHERE lead_id = $1::uuid
      ORDER BY created_at DESC, id DESC`,
    values: [leadId],
  };
}

export function buildLead360EmailSummaryQuery(leadId: string): SqlQuery {
  return {
    text: `SELECT
      status,
      count(*)::int AS count,
      max(sent_at) AS last_sent_at,
      max(updated_at) AS last_updated_at
    FROM public.email_queue
    WHERE canonical_lead_id = $1::uuid
    GROUP BY status
    ORDER BY status ASC`,
    values: [leadId],
  };
}

async function execute<Row>(query: SqlQuery): Promise<Row[]> {
  return (await sql.unsafe(query.text, query.values as never[])) as unknown as Row[];
}

function iso(value: string | Date) {
  return new Date(value).toISOString();
}

function optionalIso(value: string | Date | null) {
  return value ? iso(value) : null;
}

export async function getLead360Detail(leadId: string): Promise<Lead360Detail | null> {
  type IdentityRow = {
    id: string; name: string; email: string | null; phone: string | null;
    status: LeadStatus; identity_status: string; first_seen_at: string | Date;
    last_activity_at: string | Date; created_at: string | Date; updated_at: string | Date;
    next_follow_up_at: string | Date | null;
  };
  type InteractionRow = {
    id: string; source_type: CanonicalLeadSourceType; created_at: string | Date;
    property_id: string | null; property_title: string | null; property_slug: string | null;
    details: Record<string, unknown> | null;
  };
  type SharedRow = {
    id: string; name: string; email_match: boolean; phone_match: boolean;
    review_decision: "keep_separate" | "same_person" | null;
  };
  type RelationshipRow = {
    id: string; related_lead_id: string; related_lead_name: string;
    relationship_type: LeadRelationshipType; created_at: string | Date; updated_at: string | Date;
  };
  type NoteRow = { id: string; body: string; author_username: string; created_at: string | Date };
  type EventRow = {
    id: string; event_type: string; event_data: Record<string, unknown>;
    actor_username: string; created_at: string | Date;
  };
  type EmailRow = {
    status: string; count: number | string; last_sent_at: string | Date | null;
    last_updated_at: string | Date;
  };

  const [identityRows, interactionRows, sharedRows, relationshipRows, noteRows, eventRows, emailRows] =
    await Promise.all([
      execute<IdentityRow>(buildLead360IdentityQuery(leadId)),
      execute<InteractionRow>(buildLead360InteractionsQuery(leadId)),
      execute<SharedRow>(buildLead360SharedContactsQuery(leadId)),
      execute<RelationshipRow>(buildLead360RelationshipsQuery(leadId)),
      execute<NoteRow>(buildLead360NotesQuery(leadId)),
      execute<EventRow>(buildLead360ManagementEventsQuery(leadId)),
      execute<EmailRow>(buildLead360EmailSummaryQuery(leadId)),
    ]);

  const row = identityRows[0];
  if (!row) return null;

  return {
    identity: {
      id: row.id,
      name: row.name,
      email: row.email,
      phone: row.phone,
      status: row.status,
      identityStatus: row.identity_status,
      firstSeenAt: iso(row.first_seen_at),
      lastActivityAt: iso(row.last_activity_at),
      createdAt: iso(row.created_at),
      updatedAt: iso(row.updated_at),
      nextFollowUpAt: optionalIso(row.next_follow_up_at),
    },
    interactions: interactionRows.map((interaction) => ({
      id: interaction.id,
      sourceType: interaction.source_type,
      sourceLabel: CANONICAL_LEAD_SOURCE_LABELS[interaction.source_type],
      createdAt: iso(interaction.created_at),
      propertyId: interaction.property_id,
      propertyTitle: interaction.property_title,
      propertySlug: interaction.property_slug,
      details: interaction.details ?? {},
    })),
    sharedContacts: sharedRows.map((shared) => ({
      id: shared.id,
      name: shared.name,
      emailMatch: shared.email_match,
      phoneMatch: shared.phone_match,
      reviewDecision: shared.review_decision,
    })),
    relationships: relationshipRows.map((relationship) => ({
      id: relationship.id,
      relatedLeadId: relationship.related_lead_id,
      relatedLeadName: relationship.related_lead_name,
      type: relationship.relationship_type,
      createdAt: iso(relationship.created_at),
      updatedAt: iso(relationship.updated_at),
    })),
    notes: noteRows.map((note) => ({
      id: note.id,
      body: note.body,
      authorUsername: note.author_username,
      createdAt: iso(note.created_at),
    })),
    managementEvents: eventRows.map((event) => ({
      id: event.id,
      type: event.event_type,
      data: event.event_data,
      actorUsername: event.actor_username,
      createdAt: iso(event.created_at),
    })),
    emailSummary: emailRows.map((email) => ({
      status: email.status,
      count: Number(email.count),
      lastSentAt: optionalIso(email.last_sent_at),
      lastUpdatedAt: iso(email.last_updated_at),
    })),
  };
}
