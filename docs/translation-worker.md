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
- `TRANSLATION_WORKER_BATCH_SIZE`: fixed at `1` in production.
- `TRANSLATION_WORKER_CONCURRENCY`: fixed at `1` in production.
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
- `npm run translations:testimonial-intent -- --testimonial-id <uuid>` performs
  an isolated/local aggregate-only dry-run for exactly one testimonial body.
- `npm run translations:testimonial-intent -- --testimonial-id <uuid> --allow-production-read-only-dry-run`
  performs the same production inspection after `SET TRANSACTION READ ONLY`.
- A separately authorized production canary apply additionally requires
  `--apply --allow-production-single-testimonial-intent --confirm-exactly-one-testimonial-body`.
  `TRANSLATION_WORKER_ENABLED` and `MULTILINGUAL_ENABLED` must both be set
  explicitly to `false`. The command
  can create at most one translation row, one queued job, and the existing
  `created` and `job_queued` revision events; it never invokes the worker,
  resolves a provider, retrieves OIDC credentials, or sends text to Google.
- `npm run translations:testimonial-retry -- --testimonial-id <uuid> --allow-production-read-only-dry-run`
  inspects one existing failed testimonial-body job inside a read-only
  transaction. It reports aggregate cardinality only and resolves no provider.
- A separately authorized retry of the same failed job requires
  `--apply --allow-production-single-testimonial-retry --confirm-existing-provider-empty-result-job`.
  The command accepts only one testimonial UUID, requires both worker and
  multilingual flags to be explicitly false, requeues only an existing
  terminal `provider_empty_result` job, and appends the approved `job_queued`
  audit event. It creates neither a translation row nor a replacement job and
  never invokes Google. The original failure event remains unchanged.

General production worker `--run` and backfill `--apply` remain categorically
prohibited, even when the read-only confirmation flag is present. The narrowly
scoped testimonial intent and retry commands have their own separate,
command-line-only production confirmations. Dry-run queries use a SELECT-only
repository after `SET TRANSACTION READ ONLY`. Commands are bounded single runs;
none starts an infinite loop.

The full backfill currently covers all three approved fields (property title,
property description, and testimonial body), so it is not used for the first
canary. Intent creation and processing are separate operator actions. Before
and after a production canary, record aggregate translation/job/event counts,
keep the worker disabled while creating the intent, and verify the one-field
cardinality before any bounded provider invocation. After processing, disable
the worker immediately, review the English result in Admin, correct it manually
if necessary, then mark it reviewed and protected. On failure, keep English and
the worker disabled, leave the auditable rows intact, and do not retry or delete
records without a separate review.

The protected, unscheduled `/api/cron/process-translation-jobs` route uses the
same service and the existing `Authorization: Bearer <CRON_SECRET>` convention.
It runs in the Node.js runtime, returns aggregate summaries only, and cannot
select the fake provider.

## Hard usage budget

Migration 0021 adds aggregate-only UTC day and UTC month usage buckets. Before
each Google provider request, the worker atomically reserves the source's
Unicode character count and one provider attempt in both buckets. The ledger
stores no source or translated text, entity or job identifier, credential, or
customer data. Concurrent workers update the same rows transactionally, so
they cannot oversubscribe a limit. Retries reserve usage again.

The non-configurable production ceilings are 10,000 attempted source
characters per UTC day, 250,000 per UTC month, 20 provider attempts per UTC
day, 100 attempts per UTC month, 5,000 Unicode characters per field, batch size
1, concurrency 1, and two automatic attempts per job. If accounting is
unavailable or a limit would be exceeded, the provider is not resolved or
called. The claimed job returns to a queued, delayed, recoverable state with a
sanitized budget reason and no consumed job attempt. Sources above 5,000
characters fail safely before any provider request.

The Admin dashboard exposes only aggregate usage and job counts. It warns at
80% and states that automatic translations are paused at 100%. Applying 0021
to production is a separate, restore-protected operator step and is required
before the worker can be enabled; until then accounting fails closed.

### Google quota and billing alert hardening

After separately authorizing API activation, lower the Cloud Translation
Advanced quotas before enabling the worker: general-model characters per
project per day to 10,000; general-model characters per project per minute and
per user per minute to 5,000; and v3 requests per project per minute to 1. The
Google daily boundary resets at midnight Pacific time, while the application
ledger uses UTC, so both controls remain independently conservative. Google
does not expose a matching monthly character quota; the transactional 250,000
UTC-month application ceiling remains authoritative. A quota rejection must
not be treated as permission to bypass the application ledger.

Create an alerts-only monthly budget in Google Cloud Billing by selecting
**Budgets & alerts**, **Create budget**, limiting scope to the Boriki
Translation project and Cloud Translation service, choosing a small specified
amount, and retaining actual-spend thresholds at 50%, 90%, and 100%. Confirm
the billing recipients and finish the budget. Alerts-only budgets notify; they
do not stop requests or spending. Cloud Translation is not currently listed
among the services eligible for Google's preview spend-cap budgets, so the
application ledger and service quotas are the hard controls.

## Production migration readiness

1. Create a current Neon backup or restore point.
2. Confirm the production fingerprint through migration 0018.
3. Review migrations 0019, 0020, and 0021 and their guarded rollbacks.
4. Apply 0019, then 0020, then 0021 through the established production procedure.
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

Retryable failures use approximately 1 minute and 5 minutes with bounded
jitter under the two-attempt ceiling. Permanent, configuration, and exhausted
failures are terminal. Stale locks are recovered only after the configured
timeout.

Obsolete or protected jobs are cancelled without a provider request. Migration
0019 has no cancellation revision-event type, so cancellation is represented
only by the job lifecycle rather than misusing an unrelated audit event.

Migration 0020 adds `regeneration_authorized_at`. A manual translation remains
ineligible for the worker unless it is unprotected and this explicit Admin
authorization exists. A successful machine result clears the marker;
retryable or terminal provider failure preserves it. A newer Spanish source
invalidates the authorization and restores protection for a manual value.
Rollback of 0020 is allowed only when no authorization marker is active.
