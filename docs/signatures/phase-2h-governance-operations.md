# Phase 2H: governance activation and canary readiness

`READY != ENABLED`, `APPROVED != EDITABLE`, and `CANARY != PUBLIC LAUNCH`.

The authenticated route `/admin/signatures/gobernanza` is the supported data-entry path. It separates the external legal reviewer from the Admin operator who records the decision. Drafts may be edited outside the approval action. Submission freezes the review candidate; approval requires the exact immutable version/hash, external reviewer identity and evidence reference, an acknowledgment checkbox, and the phrase `APROBAR VERSION INMUTABLE`. Approved versions are database-protected and replacements require new versions.

No governance action changes Vercel feature flags. `SIGNING_PUBLIC_ENABLED` remains absent/false. A future production-hosted internal canary also requires a separately scoped, expiring authorization and a server-side canary gate. Neither authorization is created by migrations.

## Business/legal input checklist

Engineering cannot choose these legal or business values for Erickson Real Estate.

For every proposed document type, Cedric/Ivonne must obtain:

- the stable document name/classification;
- whether electronic signing is permitted and every condition or restriction;
- the licensed counsel name and firm;
- approval date, effective date, and durable approval/evidence reference.

For both `es-PR` and `en-US` consent, obtain the exact approved text, approval authority, approval date, effective date, and reference. For signing privacy, obtain the exact approved bilingual disclosure, privacy/legal reviewer, effective date, and reference. Draft or placeholder text never satisfies readiness.

Business/legal must decide retention for source PDFs, completed PDFs, certificates, evidence manifests, audit events, token digests, signer sessions, network-evidence digests, abandoned/failed drafts, and legal holds. A null completed-evidence duration means preservation. Legal hold always prevents eligibility. Do not enable completed cleanup without explicit approved durations for every completed-evidence class.

## Safe operator procedure

1. Sign in as an authorized Admin and open `/admin/signatures/gobernanza`.
2. Create a draft using only the exact reviewed source material. Verify the displayed version and SHA-256.
3. Submit the immutable candidate for external review. A pending record is not approved.
4. After receiving evidence, select that exact pending version, enter the external reviewer and durable evidence references, acknowledge immutability, and type the approval phrase.
5. For retention, approval and activation are separate actions. Review the aggregate-only impact preview before activation. Preview never deletes.
6. Verify the readiness matrix. Infrastructure availability is separate from legal approval and feature enablement.

Incorrect approved content is never edited in place. Retire/revoke it through a supported terminal action and create a replacement version. The immutable governance event records actor, transition, timestamp, snapshot hash, and external reference. Direct production SQL is not an approved operator workflow.

## Recovery posture

- Neon Free currently exposes a six-hour restore-history window and limited manual snapshots. No production-destructive restore is permitted. Until a real isolated restore preserves schema, relationships, hashes, and event chains, this remains `BLOCKED` or requires formal owner risk acceptance.
- R2 durability is not deletion recovery. Bucket Lock prevents deletion but is not backup and can conflict with future approved retention. Do not configure a long-lived lock before retention approval. The minimum compensating design is an independently credentialed private backup bucket/copy with hash-verified restore; it must be tested with synthetic objects before launch.

## Production-hosted internal canary procedure (future authorization only)

The future gate must require all of: public signing disabled, a time-bounded `internal_canary` authorization for `production`, exact synthetic participant scope, exact approved document-type scope, readiness snapshot/hash, explicit operator confirmation, and a server-side canary capability. No query parameter or client state may bypass it. Use only fake/sink delivery unless an internal test destination is separately authorized.

Emergency disable: remove/disable the internal canary server flag, redeploy, revoke active synthetic tokens/sessions, cancel pending synthetic deliveries, preserve audit events, and confirm `/firmar/<random-or-old-token>` returns the protected 404. Never delete immutable evidence to clean up a drill.

## Remaining recovery and browser evidence

The automated maximum topology is 25 pages, 8 participants, and 100 fields. A full interactive 25-page browser pass remains distinct evidence and must be recorded as such. Existing desktop/mobile single-participant and two-participant browser results remain valid and should not be repeated merely to refresh dates.
