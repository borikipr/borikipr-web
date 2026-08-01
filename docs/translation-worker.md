# Translation worker (Phase 3D)

The translation worker is operationally separate from public requests and from
`email_queue`. It is disabled unless `TRANSLATION_WORKER_ENABLED=true` and an
explicit provider is selected.

## Configuration

- `TRANSLATION_WORKER_ENABLED`: must be exactly `true` to process jobs.
- `TRANSLATION_PROVIDER`: currently reserves `google-cloud-translation`.
- `GOOGLE_CLOUD_PROJECT_ID`: Google Cloud project for Translation Advanced.
- `GOOGLE_CLOUD_TRANSLATION_LOCATION`: defaults to `global`.
- `GOOGLE_CLOUD_TRANSLATION_GLOSSARY_ID`: optional resource ID, disabled by
  default. Configure a real glossary separately after review.
- `TRANSLATION_WORKER_BATCH_SIZE`: 1–50, default 10.
- `TRANSLATION_WORKER_CONCURRENCY`: 1–5, default 2.
- `TRANSLATION_WORKER_LOCK_TIMEOUT_MS`: 1–60 minutes, default 10 minutes.
- `TRANSLATION_PROVIDER_TIMEOUT_MS`: 1–120 seconds, default 30 seconds.
- `TRANSLATION_WORKER_ID`: non-secret worker-name prefix.

The official `@google-cloud/translate` v3 client uses Application Default
Credentials (ADC). BorikiPR never parses or stores credentials in Neon. On
Vercel, provision ADC through the approved service-account mechanism; for local
development, `GOOGLE_APPLICATION_CREDENTIALS` may point to an untracked file.
The client is imported and instantiated lazily on the first explicitly enabled
worker request, never during imports or builds.

Cloud Translation Advanced supports glossaries. The recommended production
glossary should preserve `Borikí`, `BorikiPR`, `Erickson Real Estate`, and
`Ivonne Erickson`. Until a reviewed glossary exists, a conservative validation
rejects output that changes a protected name present in the source; it does not
rewrite provider output.

## Commands

- `npm run translations:worker:dry-run` only counts eligible jobs.
- `npm run translations:worker:run -- --confirm-local` additionally requires a
  local database, the enable flag, and a configured provider transport.

Both commands refuse Neon and production configuration. They are bounded,
single-run commands; neither starts an infinite processing loop.

The protected, unscheduled `/api/cron/process-translation-jobs` route uses the
same service and the existing `Authorization: Bearer <CRON_SECRET>` convention.
It runs in the Node.js runtime, returns aggregate summaries only, and cannot
select the fake provider.

## Production migration readiness

1. Create a current Neon backup or restore point.
2. Confirm the production fingerprint through migration 0018.
3. Review migration 0019 and its guarded rollback.
4. Apply 0019 through the established production procedure.
5. Run the structural fingerprint audit and verify all three tables/indexes.
6. Leave the worker disabled and deploy the code in that state.
7. Run protected dry-run/health checks.
8. Enable processing only after provider, IAM, glossary, and monitoring review.

Rollback is permitted only while the translation tables are empty. The guarded
rollback refuses to discard derived translation data and never alters Spanish
property or testimonial content.

Suggested initial alerts: any stale processing lock; failed-job growth across
two audits; or an oldest eligible queued job older than 30 minutes. External
alert delivery and an Admin dashboard remain intentionally deferred.

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
