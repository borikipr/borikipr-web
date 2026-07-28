# Incident runbook

## Public forms fail

Check deployment health, Neon connectivity, required configuration names,
durable rate-limit health, and structured server events. Do not enable an
email-only fallback. Preserve the user-safe error and avoid logging form data.

## Email delayed or queue stuck

Inspect aggregate queue status, stale `processing` rows, recent cron heartbeat,
and Resend status/quota. The worker recovers stale claims. Do not manually
resend sent rows or historical availability notifications.

## Cron failure

Confirm Vercel schedule, `CRON_SECRET`, last heartbeat, deployment alias, and
route response. Retry only an idempotent operation. Queue/outbox dedupe keys
must remain intact.

## Neon unavailable or bad migration

Stop writes to the affected workflow, preserve logs without PII, verify whether
the transaction committed, and follow `docs/migrations.md`. Never infer
rollback from a browser error.

## R2 unavailable

Do not expose public bucket access. Preserve database upload states and retry
only supported operations. Run reconciliation in dry-run mode after recovery.

## Admin login issue

Check cookie/security headers, session signing configuration, active user state,
rate-limit aggregates, and password-reset delivery. Do not modify password
hashes or session versions as a diagnostic shortcut.

## Private link compromise

Revoke/rotate the specific Private Showing token using the existing property
workflow, inspect access events, and avoid logging the token.

## Accidental property status change

Establish committed property/outbox state first. Do not reverse timestamps or
delete email intents. If historical recipients could be affected, produce a
dry-run review before any delivery.

