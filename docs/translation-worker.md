# Translation worker (Phase 3D)

The translation worker is operationally separate from public requests and from
`email_queue`. It is disabled unless `TRANSLATION_WORKER_ENABLED=true` and an
explicit provider is selected.

## Configuration

- `TRANSLATION_WORKER_ENABLED`: must be exactly `true` to process jobs.
- `TRANSLATION_PROVIDER`: currently reserves `google-cloud-translation`.
- `GOOGLE_CLOUD_PROJECT_ID`: Google Cloud project for Translation Advanced.
- `GOOGLE_CLOUD_AUTH_MODE`: `vercel-wif` for Vercel; `adc` is permitted only
  for explicit non-Vercel local development.
- `GOOGLE_CLOUD_PROJECT_NUMBER`: numeric project number used in the WIF
  provider audience.
- `GOOGLE_CLOUD_SERVICE_ACCOUNT_EMAIL`: dedicated translation-worker identity.
- `GOOGLE_CLOUD_WORKLOAD_IDENTITY_POOL_ID`: reviewed WIF pool identifier.
- `GOOGLE_CLOUD_WORKLOAD_IDENTITY_PROVIDER_ID`: reviewed OIDC provider ID.
- `GOOGLE_CLOUD_WORKLOAD_IDENTITY_AUDIENCE`: optional fully qualified provider
  audience; when supplied, it must exactly match the configured provider.
- `GOOGLE_CLOUD_TRANSLATION_LOCATION`: defaults to `global`.
- `GOOGLE_CLOUD_TRANSLATION_GLOSSARY_ID`: optional resource ID, disabled by
  default. Configure a real glossary separately after review.
- `TRANSLATION_WORKER_BATCH_SIZE`: 1–50, default 10.
- `TRANSLATION_WORKER_CONCURRENCY`: 1–5, default 2.
- `TRANSLATION_WORKER_LOCK_TIMEOUT_MS`: 1–60 minutes, default 10 minutes.
- `TRANSLATION_PROVIDER_TIMEOUT_MS`: 1–120 seconds, default 30 seconds.
- `TRANSLATION_WORKER_ID`: non-secret worker-name prefix.

The official `@google-cloud/translate` v3 client receives an official
`google-auth-library` external-account client in Vercel. The client obtains a
short-lived token through `@vercel/oidc`, exchanges it through Google's Security
Token Service, and impersonates the dedicated translation-worker service
account. No key file is created or stored. Local development may use explicit
ADC with an untracked `GOOGLE_APPLICATION_CREDENTIALS` path; Vercel cannot fall
back to ADC. Auth and Translation clients are constructed lazily on the first
explicitly enabled provider call, never during imports, builds, public/Admin
rendering, dry-runs, or disabled cron requests.

The Google-side WIF provider must use the reviewed team issuer, audience, and
exact production subject from Vercel. Infrastructure binds only that principal
to `roles/iam.workloadIdentityUser` on the dedicated service account.
Service-account impersonation requires the Service Account Credentials API;
enable it only in the separately approved infrastructure step. Never record an
OIDC token, service-account key, database URL, or unverified subject here.

Cloud Translation Advanced supports glossaries. The recommended production
glossary should preserve `Borikí`, `BorikiPR`, `Erickson Real Estate`, and
`Ivonne Erickson`. Until a reviewed glossary exists, a conservative validation
rejects output that changes a protected name present in the source; it does not
rewrite provider output.

## Commands

- `npm run translations:worker:dry-run` only counts eligible jobs locally.
- `npm run translations:worker:run -- --confirm-local` additionally requires a
  local database, the enable flag, and a configured provider transport.
- `npm run translations:worker:dry-run -- --allow-production-read-only-dry-run`
  permits an explicitly confirmed production aggregate inspection. It claims no
  job and never resolves a provider.
- `npm run translations:backfill:dry-run -- --allow-production-read-only-dry-run`
  permits the equivalent aggregate-only coverage inspection. It creates no
  translation, job, or event.

Production `--run` and `--apply` remain categorically prohibited, even when the
read-only confirmation flag is present. The flag is command-line only and is
not accepted from an environment variable. Dry-run queries use a SELECT-only
repository after `SET TRANSACTION READ ONLY`. Commands are bounded single runs;
neither starts an infinite loop.

The protected, unscheduled `/api/cron/process-translation-jobs` route uses the
same service and the existing `Authorization: Bearer <CRON_SECRET>` convention.
It runs in the Node.js runtime, returns aggregate summaries only, and cannot
select the fake provider.

## Production migration readiness

1. Create a current Neon backup or restore point.
2. Confirm the production fingerprint through migration 0018.
3. Review migrations 0019 and 0020 and their guarded rollbacks.
4. Apply 0019, then 0020, through the established production procedure.
5. Run the structural fingerprint audit and verify all three tables, indexes,
   the authorization column, and the updated protection constraint.
6. Leave the worker disabled and deploy the code in that state.
7. Run protected dry-run/health checks.
8. Enable processing only after provider, IAM, glossary, and monitoring review.

Rollback is permitted only while the translation tables are empty. The guarded
rollback refuses to discard derived translation data and never alters Spanish
property or testimonial content.

Suggested initial alerts: any stale processing lock; failed-job growth across
two audits; or an oldest eligible queued job older than 30 minutes. External
alert delivery and an Admin dashboard remain intentionally deferred.

## Production identity boundary and revocation

The production boundary is a dedicated Google Cloud project named **Boriki
Translation** and a dedicated `borikipr-translation-worker` service identity.
Its application permission is only `roles/cloudtranslate.user`. Runtime project,
service-account, pool, and provider identifiers remain server-only environment
configuration rather than source constants.

To revoke access without changing Spanish content: disable the worker, remove
the exact Vercel principal's `roles/iam.workloadIdentityUser` binding, disable
the WIF provider or pool, remove the dormant Vercel WIF variables, and disable
the Translation API if it is no longer needed. Identity revocation never
requires a database rollback or deletion of translation history.

## Retry and locking

Attempts increment at claim time. Claims use `FOR UPDATE SKIP LOCKED`, ordered
by priority, availability, and creation time. Provider calls occur only after
the claim transaction commits.

Retryable failures use approximately 1 minute, 5 minutes, 30 minutes, 2 hours,
and 12 hours with ±20% jitter. Permanent, configuration, and exhausted failures
are terminal. Stale locks are recovered only after the configured timeout.

Obsolete or protected jobs are cancelled without a provider request. Migration
0019 has no cancellation revision-event type, so cancellation is represented
only by the job lifecycle rather than misusing an unrelated audit event.

Migration 0020 adds `regeneration_authorized_at`. A manual translation remains
ineligible for the worker unless it is unprotected and this explicit Admin
authorization exists. A successful machine result clears the marker;
retryable or terminal provider failure preserves it. A newer Spanish source
invalidates the authorization and restores protection for a manual value.
Rollback of 0020 is allowed only when no authorization marker is active.
