# Phase 2J: finalization and recovery decision record

Date: 2026-08-11. This record contains synthetic and aggregate evidence only. It is not legal approval, launch authorization, or permission to enable signing.

## Maximum-document HTTP 400 finding

The captured isolated request trail did not contain a request to `POST /api/signatures/session/complete`. The browser harness saved one field successfully (`303`) and then replayed stale append-only field submissions (`400`). The participant therefore had incomplete required fields and the document correctly remained `partially_signed`. The response was a safe rejection, not a finalizer failure.

The contributing product/testability issue was that the signer page mounted all 25 rendered PDF pages at once. Individual page rendering took seconds in the isolated runtime, which made long-document interaction unstable. The signer viewer now mounts one private page at a time and provides previous/next, direct page selection, zoom, bounded scrolling, and overscroll containment. Production origin, CSRF, session, participant, required-field, and finalization checks are unchanged.

A regression using an actual 25-page PDF, three synthetic participants, 100 required fields distributed across all pages, real token/session/consent/field-completion domain calls, and the real finalizer completed with 100 values, one finalization event, and a valid event chain. This proves the finalization semantics and maximum topology outside the interrupted browser harness. It does not replace the still-required populated desktop and maximum-mobile browser evidence.

## Visual evidence limitation

The existing synthetic maximum PDF is 26 pages after the certificate page and 43,598 bytes. Pages 1, 5, 13, 21, and 25 were rendered for inspection. Signing fields and values were present, but Poppler emitted missing-font warnings and some source-page text was clipped in the synthetic source itself. That artifact is therefore not sufficient to promote browser-generated final PDF visual integrity to `PASS`. A clean browser-generated maximum artifact must be inspected after the interactive browser limitation is resolved.

## Neon recovery decision packet

Known capability: the current Neon plan exposes approximately six hours of restore history and limited manual snapshots. Unproven capability: an actual point-in-time or snapshot restore into an isolated target that preserves signing/governance rows, foreign keys, constraints, indexes, hashes, snapshots, and immutable event ordering.

This workspace has no Neon control-plane CLI or control-plane credential. No production restore, snapshot consumption, plan upgrade, or paid operation was attempted. Closing the evidence gap requires an authorized operator to create a disposable isolated recovery branch at a recorded recovery point, validate migration history and evidence integrity, and remove only that branch afterward. If the plan cannot create that target without consuming a scarce snapshot or an upgrade, Erickson Real Estate must choose one of:

- require the isolated restore proof before any production-hosted canary;
- perform it later through an authorized provider-console operation; or
- formally accept the residual recovery risk for a narrowly scoped internal canary.

Documentation that restore features exist is not restoration proof.

## R2 recovery decision packet

Proven in Phase 2I: a private synthetic object was copied to an application-controlled backup key, hash and byte count were verified, the synthetic source was deleted, and exact bytes were restored from the backup copy. Both test objects were removed.

This proves per-object recovery when the backup copy exists. It is not independent disaster recovery because the copy remains under the same account/control plane. Residual risks include account compromise, bucket-wide deletion, destructive credentials, and provider/account-level loss. Bucket Lock prevents deletion and is not backup; it must not be enabled before approved retention rules are available.

Available business decisions are:

- accept same-account private backup-copy risk for an internal canary;
- add an independently credentialed private backup bucket or external export before canary;
- require independent backup only before public launch; or
- keep production-hosted canary blocked until independent recovery is proven.

No risk acceptance is made by this document, and no billable or irreversible storage configuration was introduced.

## Required dormant state

`SIGNING_PUBLIC_ENABLED` and `SIGNING_INTERNAL_CANARY_ENABLED` remain absent/false. No production canary authorization, customer participant, token, session, delivery, legal approval, or retention activation is created by Phase 2J.
