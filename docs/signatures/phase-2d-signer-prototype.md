# Phase 2D disabled signer-session prototype

Phase 2D implements the private signing transport but does not authorize live
signing. `SIGNING_PUBLIC_ENABLED` defaults closed and must remain `false` in
Production. No document classification is approved by this phase.

## Transport and lifecycle

- `GET /firmar/[token]` performs a non-consuming eligibility check and shows a
  neutral landing page.
- A same-origin `POST` consumes the 32-byte bearer token exactly once, creates
  a 20-minute/10-minute-idle participant/version-bound session, and redirects
  to `/firmar/sesion` so bearer material leaves the visible URL.
- The session cookie is `HttpOnly`, `Secure`, `SameSite=Strict`, and scoped to
  `/firmar`. Mutations additionally require the session-bound CSRF nonce.
- Consent copy is explicitly synthetic and not legally approved. Its version
  and SHA-256 are retained; the text itself is not duplicated into evidence.
- Field writes are append-only, participant-bound, optimistic, idempotent, and
  limited by capture type. Drawn strokes are normalized and bounded.
- Completion verifies required fields, source/layout hashes, and the event
  chain. Final and certificate PDFs use deterministic private, non-PII R2 keys.

## Private storage

Only `signatures/final/` and `signatures/certificates/` are activated by the
synthetic completion service. Objects use conditional immutable writes and are
verified by byte count and SHA-256. No public or presigned URL is produced.

## Migration 0023

`0023_extend_signature_signer_evidence.sql` adds consent digest/version/locale
evidence, normalized vector payload storage, and Phase 2D event names. It does
not create signing data. Its rollback is permitted only before any consent,
field value, or Phase 2D event exists.

## Production isolation

Deploying the code with the flag absent or `false` makes every `/firmar/*`
entry point return an unavailable response before token/session operations.
No emails are implemented, no tokens are issued automatically, and all legal
document classifications remain pending counsel approval.
