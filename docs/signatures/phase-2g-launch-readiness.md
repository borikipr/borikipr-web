# Phase 2G: launch readiness and controlled canary

Status: engineering preparation only. Public signing remains disabled. No entry in a readiness table or authorization table changes deployment environment variables.

## Safety boundary

`SIGNING_PUBLIC_ENABLED` controls customer-facing signing and must remain absent or `false` until a separately authorized launch. Isolated drills use all three server-side conditions: non-production runtime, `SIGNING_ISOLATED_ENVIRONMENT=true`, and `SIGNING_INTERNAL_CANARY_ENABLED=true`. Query parameters and client state cannot enable the canary. The isolated runtime uses PGlite, private local object storage, and an in-memory email sink.

`READY != ENABLED`. A launch authorization is an immutable, attributable record of a human decision; it never edits Vercel configuration. Internal-canary authorizations require an expiration. No production public authorization is created by migrations or deployment.

## Governance workflow

1. Licensed counsel supplies a document-class decision and its durable reference. An Admin records it through the existing pending/decision workflow; code never infers approval.
2. An Admin creates new immutable consent versions for `es-PR` and `en-US`, checks the displayed hashes against approved text, then records the approval reference and effective date. Approved text is never edited in place.
3. An Admin creates a bilingual privacy-disclosure draft. Approval stores exact text, both SHA-256 digests, approver, approval reference, and effective date. Sent requests snapshot the exact text and hashes.
4. Business/legal owners provide retention durations and references. An Admin creates a version and activates it explicitly. With no valid active policy, cleanup fails closed. Completed cleanup stays disabled unless every completed-evidence duration is explicit.
5. A separate explicit authorization record captures environment, authorization type, readiness snapshot hash, actor, time, confirmation, notes, and—for canaries—expiration. Authorization does not enable a feature flag.

Legal holds override deletion eligibility. No cleanup job is enabled in Phase 2G. Policy preview must use aggregate counts and must never log object keys, document content, names, email, or tokens.

## Email readiness

- Visible sender domain: `borikipr.com`; Resend API reports it verified in `us-east-1`.
- Public DNS shows SPF and DKIM records.
- `_dmarc.borikipr.com` exists with `p=none` (monitoring, not enforcement).
- Signing Reply-To: `ivonneerickson@borikipr.com`.
- Manually verified Resend Free limits: 100/day and 3,000/month. The domains API does not expose account throughput limits, so operators must recheck Resend **Settings → Usage / Limits** before launch.
- No real message is part of this procedure; isolated drills use the memory sink.

## Recovery evidence (2026-08-11 UTC)

### Neon

Capability verified, restore drill deferred. The Free plan showed restore-from-history with a six-hour window and limited manual snapshots. No Neon control-plane credential is available to this workspace, and consuming a scarce production snapshot does not provide proportional evidence. Migration replay is not represented as a restore. Before public launch, perform a non-destructive branch/PITR restore, then verify migration fingerprints, signing row relationships, immutable event order/digests, and stored hashes.

### R2

The production signing prefix contains one known draft source object and no final/certificate objects. The S3-compatible credential found no lifecycle rule. Cloudflare exposes Bucket Lock, but no rule is configured; Bucket Lock prevents deletion and is not backup. Deleted-object restoration/versioning has not been demonstrated. Before public launch, choose and test either a narrowly scoped retention lock or an independent copy/backup, using synthetic objects and verifying exact post-recovery hashes. Do not configure irreversible retention without owner approval.

## Drill evidence

- Desktop Chromium enabled isolated flow: passed previously through real application routes.
- Android-sized touch flow: passed with pointer drawing, clear/re-entry, required fields, finalization, and session invalidation.
- Two-participant flow: passed ownership isolation, partial state, reissue, old-token rejection, finalization-once, downloads, hashes, manifest, and 48-event chain verification.
- Maximum topology: 25 pages, 8 participants, 100 fields; source 12,179 bytes, final 43,598 bytes, 147 ms finalization, approximately 12.4 MB heap delta. Automated finalization and visual prototype evidence passed. A complete eight-person interactive browser run is not required because it would repeat participant behavior without adding material pipeline evidence.

## Failure and teardown procedure

Delivery rejection/ambiguity leaves a sanitized failed intent and never retries a bearer URL automatically. Expired, revoked, superseded, completed, and cross-participant access fail closed. Temporary R2/finalization failure leaves no finalized database state and a later bounded retry finalizes once. Duplicate/concurrent completion is idempotent.

After any canary: stop the isolated runtime; revoke or expire active synthetic sessions/tokens; cancel pending synthetic delivery; remove local synthetic object files only where test-data policy permits; retain immutable synthetic evidence as documented; verify production flags remain absent/false and a random production `/firmar/<token>` is 404/private/no-store/noindex.

## Emergency disable

Remove/keep absent `SIGNING_PUBLIC_ENABLED`, remove any non-production internal-canary flag, redeploy, revoke active tokens/sessions through domain actions, cancel pending signing delivery, and confirm signer routes return protected 404. Never delete event history or replace completed objects manually.
