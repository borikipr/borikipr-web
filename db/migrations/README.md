# Database migrations

Migrations in this directory are ordered, reviewed SQL artifacts. They are not
executed during application startup or deployment.

Safety rules:

1. Validate a migration locally with `npm run migration:validate`.
2. Review the exact SQL and its rollback notes.
3. Apply it only to a disposable Neon branch or explicitly designated
   development database.
4. Compare the resulting catalog with the migration's expected objects.
5. Production execution requires a separate, explicit approval.

The validation command uses an ephemeral in-process PostgreSQL-compatible
database. It does not read `DATABASE_URL`, `.env.local`, or any Neon
credentials. This repository intentionally has no command that automatically
applies migrations to a remote database.

Each migration file must include a matching rollback file. Rollbacks are
manual review artifacts, not automatic deployment behavior.

Migrations are validated in order through `0007`. The validator creates only
ephemeral local fixtures for the pre-existing `propiedades`,
`consultas_propiedad`, Priority Registration, and email queue structures needed
to exercise the reviewed foreign keys and rollback behavior. It verifies each
new catalog shape and preserves the baseline objects. No validation command
connects to Neon.

Document security: typed lead submissions persist the private R2 object key as
the canonical document reference. They do not persist a public or permanent
document URL. Future authenticated admin access must generate a short-lived
signed URL from `document_object_key` at request time.

Migration `0003` extends `email_queue` additively for canonical leads and typed
submissions. Application code that uses those columns must remain disabled until
the migration has been separately reviewed and applied to its target database.
The legacy `related_lead_id` column and its Priority Registration foreign key are
not changed or repurposed.

Migration `0004` additively prepares `consultas_propiedad` for a future,
feature-gated Open House / Showing V2 flow. Its canonical lead, idempotency,
showing-event, source-path, and private document-key/status fields are nullable
so the current legacy route remains compatible. It does not replace the typed
Open House registration table or add uniqueness that would prevent corrected or
later-event submissions.

Migration `0005` may be applied only while `consultas_propiedad` is empty. Its
transactional guard aborts before any alteration when a row exists. When safe,
it changes the property foreign key from `ON DELETE CASCADE` to `ON DELETE
RESTRICT`, makes `propiedad_id` required, and standardizes `created_at` as a
required `timestamptz` with `now()` as its default. Its rollback has the same
empty-table guard because reversing those semantics after registrations exist
requires a separate data review.

Migration `0006` additively links Priority Registration to the canonical lead
model. Its nullable `lead_id` preserves all historical registrations and legacy
runtime behavior, uses `ON DELETE RESTRICT`, and is supported by a partial
lookup index. Historical rows are not backfilled by the migration.

Migration `0007` adds the Lead 360 CRM layer without changing any persisted form
table. It adds only `leads.next_follow_up_at` plus dedicated internal notes,
person relationships, duplicate-review decisions, and management audit events.
All lead foreign keys use `ON DELETE RESTRICT`; shared contact data is never a
unique identity constraint. Its rollback refuses to discard any Lead 360 data.
