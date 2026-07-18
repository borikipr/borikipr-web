import { sql } from "../../lib/db";
import {
  planPriorityRegistrationBackfill,
  type BackfillLeadCandidate,
  type HistoricalPriorityRegistration,
} from "../../lib/leads/priority-registration-backfill";
import { createPostgresLeadResolverInTransaction } from "../../lib/leads/postgres-resolver";

const apply = process.argv.includes("--apply");

if (apply && process.env.PRIORITY_REGISTRATION_BACKFILL_APPLY !== "YES") {
  throw new Error(
    "Apply mode requires PRIORITY_REGISTRATION_BACKFILL_APPLY=YES after dry-run review."
  );
}

const registrations = await sql<HistoricalPriorityRegistration[]>`
  SELECT id::text,
         name,
         email,
         phone,
         lead_id::text AS "leadId"
    FROM public.property_priority_registrations
   ORDER BY created_at, id
`;
const existingLeads = await sql<BackfillLeadCandidate[]>`
  SELECT id::text,
         name,
         email_normalized AS "emailNormalized",
         phone_normalized AS "phoneNormalized"
    FROM public.leads
   WHERE status <> 'merged'
   ORDER BY created_at, id
`;
const plan = planPriorityRegistrationBackfill(registrations, existingLeads);

if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", ...plan.summary }));
  await sql.end();
  process.exit(0);
}

let linked = 0;
let created = 0;
let matched = 0;

for (const action of plan.actions) {
  const outcome = await sql.begin(async (transaction) => {
    await transaction.unsafe(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["priority-registration-backfill-v1"]
    );
    const rows = await transaction.unsafe<
      Array<{
        id: string;
        name: string;
        email: string;
        phone: string;
        lead_id: string | null;
      }>
    >(
      `SELECT id::text, name, email, phone, lead_id::text
         FROM public.property_priority_registrations
        WHERE id = $1::uuid
        FOR UPDATE`,
      [action.registrationId]
    );
    const registration = rows[0];
    if (!registration || registration.lead_id) return "skipped" as const;

    const resolver = createPostgresLeadResolverInTransaction(transaction);
    const resolved = await resolver.resolveOrCreate({
      name: registration.name,
      email: registration.email,
      phone: registration.phone,
    });
    const updated = await transaction.unsafe<{ id: string }[]>(
      `UPDATE public.property_priority_registrations
          SET lead_id = $1::uuid
        WHERE id = $2::uuid
          AND lead_id IS NULL
        RETURNING id::text`,
      [resolved.lead.id, registration.id]
    );
    if (updated.length !== 1) {
      throw new Error("Priority Registration backfill lost its guarded row.");
    }
    return resolved.outcome;
  });

  if (outcome === "skipped") continue;
  linked += 1;
  if (outcome === "matched") matched += 1;
  else created += 1;
}

console.log(
  JSON.stringify({
    mode: "apply",
    registrationsReviewed: plan.summary.registrationsReviewed,
    canonicalLeadsCreated: created,
    existingLeadsMatched: matched,
    registrationsLinked: linked,
    ambiguousGroups: plan.summary.ambiguousGroups,
    conflicts: plan.summary.conflicts,
    registrationsLeftUnlinked: plan.summary.registrationsLeftUnlinked,
  })
);
await sql.end();
