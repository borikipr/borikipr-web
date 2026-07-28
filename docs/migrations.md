# Database migration runbook

## Rules

1. Name forward migrations `NNNN_description.sql` and provide
   `NNNN_description.rollback.sql` when rollback is safe.
2. Never apply schema changes from a page request, server action, or cron.
3. Prefer additive columns/tables, explicit checks, supporting indexes, and
   `ON DELETE RESTRICT` for customer and audit ownership.
4. Data transformations must be deterministic. Ambiguous identity or document
   ownership is never backfilled automatically.
5. Validate the complete ordered chain locally with
   `npm run migration:validate`.

## Production procedure

1. Confirm a current Neon restore point/branch and record aggregate preflight
   counts without PII.
2. Run `npm run schema:audit`; review missing and unexpected versions.
3. Review forward and rollback SQL. Estimate locks for existing-table changes.
4. Apply only the next missing migration in Neon using the approved read/write
   operator session.
5. Re-run `npm run schema:audit` and the migration-specific read-only checks.
6. Deploy the code that consumes the new schema.

The repository currently infers historical versions through structural
fingerprints because the original migrations predate an application migration
ledger. The audit command does not claim that old files were run automatically.
A future ledger may record newly applied migrations, but historical rows must
only be baselined after manual production verification.

## Rollback

Rollback application code first when it is compatible with the additive
schema. Run a rollback SQL file only after confirming it cannot remove live
data or break an older deployment. Never roll back a destructive data
transformation blindly. For a partial migration, stop traffic to the affected
workflow, inspect transaction state, and use the migration-specific recovery
plan or Neon restore point.

