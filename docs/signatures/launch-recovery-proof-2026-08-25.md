# Borikí Sign launch recovery evidence - 2026-08-25

This record contains operational recovery evidence and aggregate verification only. It contains no credentials, private object keys, customer identities, signed URLs, or document contents. It does not enable either signing feature flag.

## Neon isolated point-in-time recovery - PASS

- Source: production branch `main` in the Borikí Neon project.
- Recovery mechanism: a disposable child branch created from Neon history using **Branch data and schema from a past point in time**.
- Recorded recovery point: `2026-08-25T22:56:37.428-04:00` (`America/La_Paz`, equivalent UTC instant preserved by Neon).
- Isolated target: `launch-recovery-proof-2026-08-25`.
- Isolation: no restore was applied to the production branch and no production row was mutated.
- Neon confirmation: the branch was forked successfully and configured to auto-delete after one day.
- Read-only verification on the recovered branch:
  - database reachable;
  - 50 public tables present;
  - 20 signing tables present;
  - 12 signing document records present at the recovery point;
  - migration 0038 structural constraint present;
  - PostgreSQL 17 and six-hour history capability confirmed in the provider console.

Result: the production PostgreSQL schema and representative aggregate signing data were recovered into an isolated target from an actual historical point. This closes the prior `neon_restore_unproven` evidence gap.

## R2 independent recovery - BLOCKED

The authorized Cloudflare session exposes the configured private R2 buckets under one Cloudflare account. Existing Phase 2I evidence proves byte-for-byte restore from an application-controlled same-account private copy. That remains useful object-level recovery but does not protect against account/control-plane loss and therefore is not independent disaster recovery.

No second independently controlled account, external private object store, or durable encrypted export target is currently configured or authorized. Cloudflare's internal durability and provider replication are not an independently credentialed customer recovery copy. No production object, bucket policy, access token, or billing setting was changed during this inspection.

To close `r2_independent_recovery_unproven`, provision one of the following and then perform a synthetic byte-for-byte restore test:

1. a private bucket in a separately controlled Cloudflare account with separate least-privilege credentials; or
2. a private object store at a second provider/account with encrypted scheduled copies, retention controls, and a documented restore path.

Required proof: upload/copy a synthetic object, record its SHA-256 and byte count, recover it through the independent credentials after making the primary copy unavailable to the test process, verify exact bytes/hash and private access, and retain only non-secret evidence.

Because this independent target does not exist, `SIGNING_R2_INDEPENDENT_RECOVERY_PROVEN` must remain absent/false and canonical public readiness must remain blocked.
