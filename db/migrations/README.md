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

Migrations are validated in order through `0021`. The validator creates only
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

Migration `0008` extends only the existing Lead 360 management-event check with
the `contacted` event used by the Follow-up Center. It adds no table or column.
Its rollback refuses to run after a contacted event has been recorded.

Migration `0009` extends that same check with `document_accessed` for secure
Lead 360 document auditing. It adds no table or column and stores no object key,
signed URL, file contents, or customer contact data. Its rollback is guarded.

Migration `0010` adds immutable merge lineage metadata and a dedicated
`lead_merge_events` audit table. Lead merges retain both canonical rows, move
supported dependencies transactionally, and mark the secondary row as merged
without deleting it. The rollback is blocked once merge history exists.

Migration `0011` adds operational Client Cases without changing canonical lead
identity. A case may contain several active lead memberships, has one optional
primary contact, its own status and follow-up, shared notes, and an audit event
stream. Membership removal is soft and auditable. Every lead and property
foreign key uses `ON DELETE RESTRICT`, and the guarded rollback refuses to
discard any case data.

Migration `0012` extends the existing Client Case audit-event constraint for
explicit member-role and primary-contact changes. It adds no new storage model
and does not rewrite existing cases or canonical leads.

Migration `0013` extends the existing `admin_users` authentication source with
display/profile fields and session versioning. It adds hashed, expiring,
single-use password-reset tokens and pseudonymous rate-limit attempt records;
it does not create another administrator store or add account-management UI.
Its rollback is guarded once any new authentication data exists.

Migration `0014` links an Open House registration to the Property Buyer Profile
whose private financial document was safely reused. It preserves both source
records, uses `ON DELETE RESTRICT`, and adds no public document reference.

Migration `0015` adds the independent
`propiedades.open_house_solar_question_enabled` boolean. It defaults to `false`,
does not copy or change `placas_en_lease`, and therefore leaves the existing
Buyer Profile configuration and historical Open House answers untouched. Its
rollback refuses to discard an enabled Open House configuration.

Migration `0016` adds one permanent, unique, high-entropy private Showing token
to every property and an explicit `workflow_source` discriminator to the
existing `consultas_propiedad` model. Historical rows remain `open_house`;
private registrations use `private_showing` and persist only a sanitized source
path without the raw token. The token is retrievable only through the
authenticated, on-demand Admin action. Its rollback refuses to discard any
private Showing registration.

Migration `0019` adds the provider-independent multilingual persistence
foundation. `content_translations` uses real nullable foreign keys to properties
and testimonials plus an exactly-one-owner constraint; it does not use a weak
polymorphic entity ID. `translation_jobs` stores durable translation intent
without source text or credentials, and `translation_revision_events` provides
append-only audit storage. All three tables contain derived content only. The
guarded rollback refuses to discard any translation, job, or revision row and
never alters Spanish property or testimonial data.

Migration `0020` adds the nullable authorization marker used when an
authenticated administrator deliberately allows automation to replace a
manual translation. It preserves every existing translation and keeps manual
or reviewed content protected unless that explicit authorization exists. Its
rollback refuses to remove an active authorization state, restores the 0019
protection constraint, and leaves all translations, jobs, history, and Spanish
source content intact.

Migration `0021` adds aggregate-only daily and monthly provider-usage buckets.
The buckets contain only provider name, UTC period, attempted character count,
attempt count, and timestamps—never source text, translated text, entity IDs,
job IDs, credentials, or customer data. It also changes the default for new
translation jobs to two automatic attempts. Its rollback refuses to discard
any usage accounting and restores the previous job default only when safe.

Migration `0026` adds immutable bilingual privacy-disclosure text snapshots to
each signature request when it leaves draft state. Historical signer views and
detached evidence resolve the exact approved text from the request rather than
a mutable active environment value. Its rollback refuses to discard snapshots.
