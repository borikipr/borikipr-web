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

Migrations are validated in order. The Phase 2 validator applies `0001` as the
canonical lead prerequisite, creates only a local `propiedades` fixture needed
to exercise the approved foreign key, applies `0002`, verifies its catalog and
constraints, and then verifies that the `0002` rollback preserves its baseline
tables. No validation command connects to Neon.

Document security: typed lead submissions persist the private R2 object key as
the canonical document reference. They do not persist a public or permanent
document URL. Future authenticated admin access must generate a short-lived
signed URL from `document_object_key` at request time.

Migration `0003` extends `email_queue` additively for canonical leads and typed
submissions. Application code that uses those columns must remain disabled until
the migration has been separately reviewed and applied to its target database.
The legacy `related_lead_id` column and its Priority Registration foreign key are
not changed or repurposed.
