# Phase 2I: recovery proof and canary authorization readiness

Status: engineering evidence only. Public signing and the production internal canary remain disabled. No legal or governance approval is created by this work.

## Legal hold boundary

Migration `0031` adds durable legal holds scoped to a document, document version, or evidence class. Active holds override retention eligibility. Release is a separate, strongly confirmed action; both placement and release create immutable governance events. Holds never expire silently and are never deleted. No destructive cleanup job is enabled.

## Production-hosted canary gate

Production signer access requires all of the following:

1. `SIGNING_PUBLIC_ENABLED` remains false or absent.
2. `SIGNING_INTERNAL_CANARY_ENABLED=true` is set temporarily by an authorized operator.
3. `SIGNING_INTERNAL_CANARY_READINESS_SHA256` is an exact 64-character readiness digest.
4. A durable, active, unexpired `internal_canary` authorization exists for `production` with the same digest.
5. The exact participant UUID and document classification appear in that immutable authorization scope.

The checks run at token landing, token exchange, every signer-session request, completion-token exchange, and completed-file access. Query parameters cannot enable access. A public-launch authorization cannot substitute for an internal-canary authorization. Readiness and authorization do not edit Vercel configuration.

Emergency disable order: remove the internal-canary flag and readiness digest; redeploy; explicitly revoke the active internal-canary authorization; revoke pending synthetic tokens and sessions; cancel pending synthetic delivery; confirm `SIGNING_PUBLIC_ENABLED` is still absent/false; verify a random `/firmar/<token>` returns protected 404. Preserve all immutable events.

## Neon recovery evidence

Result on 2026-08-11: **not proven**. The current Free account exposes approximately six hours of restore history and limited manual snapshots, but this workspace has no Neon control-plane credential and no safe isolated restore target was available. No production snapshot was consumed and production was not touched. Migration replay is not described as restoration.

To close: create a non-production branch at a recorded recovery point, validate migrations, tables, constraints, indexes, foreign keys, event order/digests, hashes, JSON/text snapshots and aggregate counts, then delete only the isolated recovery branch. If this consumes a scarce snapshot or requires a paid plan, obtain owner approval first. Until then this is blocked or requires formal risk acceptance.

## R2 recovery proof

On 2026-08-11 an application-controlled proof used a random 4,096-byte object under a dedicated synthetic recovery prefix in the configured private bucket. The procedure uploaded the source, verified byte count/hash, copied it to a private backup key, verified the backup hash, deleted only the synthetic source, restored it from the backup, and verified exact bytes/hash. Both synthetic keys were then removed. No public URL or customer object was used.

This proves controlled recovery from an existing private backup copy. It does **not** prove independent account/bucket disaster recovery. Bucket Lock prevents deletion and is not backup. Before customer launch, choose either an independent private backup bucket/account or formally accept same-account risk; review retention policy before any irreversible lock.

## Maximum-document browser evidence

The isolated real application rendered the populated 25-page document with 3 synthetic participants and 100 fields. Admin page navigation 1→13→25, 150% zoom, keyboard movement, early/middle/final overlays, and send preparation passed. The real signer route rendered all 25 pages. Three participant-bound sessions accepted consent and submitted 33, 33, and 34 owned required fields (100 total); cross-participant UI exposure was not observed. Field submission took about 105 seconds per participant because every field exercised the real API.

All participants reached `completed`, but the final completion request returned a safe HTTP 400 and left the document `partially_signed`; no completed database state was claimed. The isolated PGlite store was later unavailable after forced harness shutdown, so the sanitized underlying finalizer error could not be recovered reliably. Existing automated maximum finalization remains green, but the populated interactive finalization gap is still **blocked** and must be reproduced in a clean isolated database before a production-hosted canary.

Mobile maximum-document validation also remains deferred: the in-app browser surface did not expose viewport/device emulation. The previously completed Android-sized touch drill for a smaller synthetic request remains valid, but it is not represented as maximum-document proof.

## Legal/governance input package

Engineering cannot choose these values for Erickson Real Estate.

- Target classification: exact document type/key, whether e-signature is allowed, conditions, licensed counsel name and organization, approval date, durable reference.
- `es-PR` consent: exact approved text, effective date, approving authority and reference.
- `en-US` consent: required only when English participants are in scope; provide the same approval evidence.
- Privacy disclosure for every canary locale: exact approved text, effective date, legal/privacy reviewer and reference.
- Retention: approved preservation/cleanup rule for source documents, final PDFs, certificates, manifests, audit events, drafts, expired/abandoned requests, delivery metadata, sessions, token digests, network digests and legal-hold records.

### Non-binding retention worksheet

| Evidence class | Approved duration or preservation rule | Business owner | Legal/privacy reviewer | Reference | Effective date |
|---|---|---|---|---|---|
| Source document |  |  |  |  |  |
| Final signed PDF |  |  |  |  |  |
| Certificate |  |  |  |  |  |
| Evidence manifest |  |  |  |  |  |
| Audit events |  |  |  |  |  |
| Draft requests |  |  |  |  |  |
| Expired/abandoned requests |  |  |  |  |  |
| Delivery metadata |  |  |  |  |  |
| Session records |  |  |  |  |  |
| Token digests |  |  |  |  |  |
| Network digests |  |  |  |  |  |
| Legal-hold records |  |  |  |  |  |

Values in this worksheet are inactive until externally reviewed and entered through the authenticated governance workflow with immutable approval evidence.
