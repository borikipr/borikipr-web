# Phase 2C: authenticated draft assembly

Phase 2C is an Admin-only prototype. It validates and stores compatible source
PDFs, participants, and field definitions, but cannot invite or serve a signer.
Every configured document type remains pending counsel review, so the domain
Send gate fails closed before a token, status transition, or email can exist.

## Private storage

Only `signatures/source/` is active. Keys contain an opaque document UUID,
version number, and source SHA-256; they contain no filename, participant, lead,
or customer data. Source objects are private and are read only through an
authenticated, `private, no-store` Admin response. Phase 2C does not use public
or presigned R2 URLs.

An upload is accepted only after the Phase 2A structural gate checks MIME, the
3 MB limit, 25-page limit, encryption, XFA, embedded files, JavaScript/actions,
existing digital signatures, and malformed structures. The exact bytes are
hashed before upload. Database creation is transactional; a newly created
source object is removed if that transaction fails.

## Evidence key ring

The server requires three settings:

- `SIGNATURE_EVENT_HMAC_KEYS_JSON`: JSON map of positive integer versions to
  base64url keys containing at least 32 random bytes.
- `SIGNATURE_EVENT_HMAC_CURRENT_VERSION`: the version used for new events.
- `SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY`: an independent base64url key of at
  least 32 random bytes.

There are no production defaults. Missing or malformed settings fail closed.
Rotation adds a new version to the JSON map and changes the current version;
historical keys remain available to verify existing chains. Remove an old key
only after its evidence has reached the approved retention boundary. Never use
`NEXT_PUBLIC_*`, log the map, or reuse session, cron, R2, or email secrets.

## Admin surface

- `/admin/signatures` lists and filters drafts/future states.
- `/admin/signatures/nuevo` validates and creates a private draft.
- `/admin/signatures/[id]` manages participants and normalized fields and
  shows source/layout hashes.
- private source and rendered-page endpoints require the current Admin session.

Lead and Shared Case selectors are read-only lookups. The signature subsystem
stores only optional foreign keys and historical participant snapshots; it does
not create or update CRM entities.

## Migration 0022 production procedure

1. Confirm a restore point and that migrations through 0021 are present.
2. Confirm all eight `signature_*` tables are absent and no signing objects
   exist under the private namespaces.
3. Execute `db/migrations/0022_create_signature_foundation.sql` as one script.
4. Verify eight tables, constraints, indexes, and triggers using catalog reads;
   confirm every new table contains zero rows.
5. Configure the versioned HMAC settings through the server-only Production
   secret mechanism before allowing an Admin mutation.

Rollback uses `0022_create_signature_foundation.rollback.sql` only while every
signature table is empty and no signing object exists. Once a draft exists,
retain the additive schema and roll back application code instead.
