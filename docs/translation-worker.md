# Translation worker (Phase 3D)

The translation worker is operationally separate from public requests and from
`email_queue`. It is disabled unless `TRANSLATION_WORKER_ENABLED=true` and an
explicit provider is selected.

## Configuration

- `TRANSLATION_WORKER_ENABLED`: must be exactly `true` to process jobs.
- `TRANSLATION_PROVIDER`: currently reserves `google-cloud-translation`.
- `GOOGLE_CLOUD_PROJECT_ID`: Google Cloud project for Translation Advanced.
- `GOOGLE_CLOUD_TRANSLATION_LOCATION`: defaults to `global`.
- `TRANSLATION_WORKER_BATCH_SIZE`: 1–50, default 10.
- `TRANSLATION_WORKER_CONCURRENCY`: 1–5, default 2.
- `TRANSLATION_WORKER_LOCK_TIMEOUT_MS`: 1–60 minutes, default 10 minutes.
- `TRANSLATION_PROVIDER_TIMEOUT_MS`: 1–120 seconds, default 30 seconds.
- `TRANSLATION_WORKER_ID`: non-secret worker-name prefix.

Credentials are not accepted by BorikiPR configuration or stored in Neon. When
the official Google transport is installed in a later controlled phase, it must
use the official SDK's Application Default Credentials. The current registry
refuses Google processing until that transport is explicitly injected.

## Commands

- `npm run translations:worker:dry-run` only counts eligible jobs.
- `npm run translations:worker:run -- --confirm-local` additionally requires a
  local database, the enable flag, and a configured provider transport.

Both commands refuse Neon and production configuration. They are bounded,
single-run commands; neither starts an infinite processing loop.

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
