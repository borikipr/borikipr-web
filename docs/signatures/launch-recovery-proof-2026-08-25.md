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

## R2 independent recovery - PASS

- Recovery boundary: a separate Cloudflare account named `Borikí Sign Recovery`, distinct from the primary Borikí account and independently authenticated.
- Recovery destination: private Standard-class bucket `boriki-sign-recovery` in the recovery account.
- Public access verification:
  - no custom domain assigned;
  - Public Development URL disabled;
  - no CORS policy configured;
  - anonymous S3 endpoint access did not return the object.
- Proof credential: a separate account token limited to Object Read & Write for the recovery bucket only, with a 24-hour TTL. It granted no bucket-administration or primary-account access.
- Proof time: `2026-08-26T10:00:36Z` (UTC), `2026-08-26T06:00:36-04:00` (`America/Puerto_Rico`).
- Test artifact: isolated synthetic one-page PDF produced by the Date Signed launch-blocker regression fixture; no customer data or production signing evidence was used.
- Safe logical reference: `synthetic-date-signed-corrected.pdf`.
- Byte length: `89370`.
- Source SHA-256: `6aed846bb475fd72c5b93e744de0431ad8609a97b9f2308dddbedce0b95f7fb4`.
- Independent backup SHA-256: `6aed846bb475fd72c5b93e744de0431ad8609a97b9f2308dddbedce0b95f7fb4`.
- Restored SHA-256: `6aed846bb475fd72c5b93e744de0431ad8609a97b9f2308dddbedce0b95f7fb4`.
- Restore method: download from the independent account using only the bucket-scoped recovery credential into an isolated local recovery path; the primary object was not overwritten or deleted.
- Verification:
  - source, backup, and restored hashes matched;
  - source and restored byte counts matched;
  - byte-for-byte comparison passed;
  - restored PDF parsed as one page and rendered successfully;
  - primary R2 buckets and credentials were not modified, rotated, or deleted.

Result: the recovery copy survives loss of access to the primary R2 account because it is held in a separate Cloudflare account, is not deleted automatically with the primary bucket, and can be retrieved without primary R2 credentials. This closes `r2_independent_recovery_unproven` for canonical public readiness. The proof token is intentionally short-lived; future restore operations require a newly authorized bucket-scoped credential from the independent recovery account.
