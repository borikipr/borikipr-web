# Electronic-signature foundation (Phase 2B)

Phase 2B adds an isolated database and server-domain foundation. It does not add
public signer routes, Admin signing UI, email delivery, R2 writes, or production
activation.

## Legal admission boundary

The document classifications in `lib/signatures/document-classification.ts`
remain counsel-gated. Every current classification has `approvalState:
"pending_counsel_review"`. A draft may be assembled, but send preparation fails unless
the exact document type is explicitly approved and the document stores a
non-empty counsel approval reference. No type is approved by this migration.

## Tables and limits

Migration 0022 creates the eight `signature_*` tables. PostgreSQL CHECK
constraints enforce the 3,000,000-byte source limit, 4,000,000-byte final limit,
25-page limit, normalized geometry, bounded values, allowed lifecycle values,
hash formats, and isolated R2-key formats. Locking triggers enforce at most eight
participants, 100 total fields, and 40 fields per participant without allowing
concurrent writers to oversubscribe those limits.

The domain service validates the same boundaries before attempting writes. The
database remains the final enforcement layer.

## Immutability and lifecycle

Once send preparation locks a version, its source metadata, geometry, field
definitions, participant identity snapshots, and field definitions cannot be
changed. Final PDF and certificate metadata may be established exactly once and
then become immutable. Field values are append-only and unique per field.
Completed/finalized documents cannot return to editable states. Explicit
document and participant transition maps reject reverse transitions.

`signature_events` rejects UPDATE and DELETE operations. Event inserts require a
continuous sequence and previous digest. Event HMACs are calculated over a
canonical JSON representation and include a key version. Verification can detect
a broken chain or altered event fields. This is tamper-evident evidence; it does
not make malicious database-administrator changes impossible when that
administrator can also access application HMAC keys.

Event creation uses the current key version. Chain verification accepts an
injected key-version resolver so historical verification can retain prior keys
after a controlled rotation without using an old key for new events.

## Tokens and signer sessions

Signing tokens use 32 cryptographically random bytes. Only a SHA-256 digest is
persisted. Verification uses constant-time comparison and binds the token to its
participant and exact document version while enforcing expiration, revocation,
and supersession. Successful session creation atomically marks the token consumed;
the same plaintext link cannot create a second session.

Signer sessions use independent 32-byte session secrets and CSRF nonces. Only
their digests are stored. Sessions are bound to the participant/version/token,
have absolute and idle expirations, and support explicit revocation. No route or
cookie implementation exists in this phase.

## Storage namespaces

R2 helper functions only construct deterministic, non-PII keys under:

- `signatures/source/`
- `signatures/artifacts/`
- `signatures/final/`
- `signatures/certificates/`

The helpers perform no storage or network operation. Phase 2B writes nothing to
R2.

## Operational boundary and next phase

Production migration application is deliberately outside Phase 2B. Before any
route or UI is added, Phase 2C should provide an authenticated Admin-only draft
assembly workflow, private R2 upload/fetch adapters, field-definition hashing,
and send-preparation orchestration against synthetic documents. Email delivery
and public signing should remain deferred until those components pass isolated
security and authorization tests.
