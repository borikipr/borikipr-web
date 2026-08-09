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

For migration `0019`, deploy schema and repository primitives before any
translation write-flow integration. Do not run a backfill or a provider worker
as part of the migration. Its rollback is allowed only while all three
translation tables are empty; otherwise retain the additive schema and roll
back application usage first.

Migration `0020` adds the explicit regeneration-authorization timestamp used
by the Admin translation workflow. Apply it after 0019 and before deploying
Phase 3E code. Its rollback refuses to remove an active authorization; clear or
finish those workflows through reviewed application behavior before rollback.
The rollback restores the original manual-protection constraint and never
changes Spanish source content, translated values, jobs, or revision events.

The hardening release has a one-purpose guarded runner:

```bash
node scripts/migrations/apply-hardening-0017-0018.mjs --confirm=APPLY_0017_0018
```

It refuses partial or repeated application and reports only aggregate row
counts. It must not be repurposed for later migrations.

The repository currently infers historical versions through structural
fingerprints because the original migrations predate an application migration
ledger. The audit command does not claim that old files were run automatically.
A future ledger may record newly applied migrations, but historical rows must
only be baselined after manual production verification.

Migration `0022` creates only the isolated electronic-signature foundation. Its
rollback refuses to run while any `signature_*` table contains data. Applying it
does not enable signing: all document classifications remain pending counsel,
and there is no signer route or email delivery. The Phase 2C Admin prototype may
store only compatible draft source PDFs in the private `signatures/source/`
namespace. Its Send gate remains closed until a document type has a recorded
counsel approval reference.

Before applying `0022`, validate both forward and rollback paths against an
isolated database, confirm all eight `signature_*` tables are absent in
production, and record aggregate counts only. Apply the migration in one
transaction. Verify the eight tables, expected constraints and triggers without
inserting signing records. Rollback is permitted only before any signing row or
private signing object exists; otherwise deploy the previous application while
retaining the additive schema.

## Rollback

Rollback application code first when it is compatible with the additive
schema. Run a rollback SQL file only after confirming it cannot remove live
data or break an older deployment. Never roll back a destructive data
transformation blindly. For a partial migration, stop traffic to the affected
workflow, inspect transaction state, and use the migration-specific recovery
plan or Neon restore point.
