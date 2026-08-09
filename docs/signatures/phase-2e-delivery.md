# Phase 2E gated delivery and completed-document access

Phase 2E remains closed in Production unless `SIGNING_PUBLIC_ENABLED=true`.
The flag is checked server-side before send actions, signing delivery processing,
token exchange, and signer access. Creating a counsel record or consent record
does not enable signing by itself.

## Governance and send gate

- Counsel decisions are durable records with `pending`, `approved`,
  `restricted`, and `revoked` states. No seed or migration approves a type.
- Consent text is versioned by locale and SHA-256. Approved or retired consent
  evidence is immutable; revisions require a new version.
- Send preparation requires the public gate, a current approval, a current
  approved consent version, valid expiry, compatible source/version hashes,
  valid participants and required fields, and configured evidence keys.
- The selected approval and consent records are bound to the sent document and
  cannot be changed after it leaves draft state.

## Delivery boundary

`signature_delivery_intents` stores recipient and status snapshots, a token
record reference, and an idempotency key. It never stores bearer URLs, HTML, or
plaintext tokens. A token is generated only after a delivery worker claims one
intent; the invitation URL exists only while building the outbound message.

Provider failures are terminal for that intent and revoke its transient token.
They are not automatically retried because an ambiguous provider response could
have delivered the old link. An Admin reissue creates a new intent, revokes or
supersedes the old token, and retains the full delivery history.

Automatic reminders are intentionally disabled. A future reminder policy must
require an active, incomplete, unexpired request; a cooldown; a fixed maximum;
an idempotency key; and an explicit token-rotation policy.

## Completed artifacts

Admin and participant download paths read only private R2 objects under
`signatures/final/` and `signatures/certificates/`. Every response verifies the
stored byte count and SHA-256 and uses private/no-store, noindex, nosniff,
no-referrer, and restrictive CSP headers. Participant access requires a
one-time, participant/version-bound completion token exchanged for a short
session. No public or presigned R2 URL is created.

## Migration sequence and rollback

Phase 2D already owns migration 0023. Phase 2E therefore adds migration 0024.
Apply in order with the repository migration runner after verifying the signing
tables are empty. The guarded 0024 rollback is safe only before approvals,
consents, deliveries, or completion-access tokens exist; it restores the 0023
event constraints and removes only Phase 2E schema.

## Launch checkpoint

Before a separate live-signing approval, require all of the following:

1. counsel supplies and an authorized operator records an active approval;
2. reviewed Spanish and English consent versions are recorded and approved;
3. event-key rotation and recovery procedures are rehearsed;
4. Resend sender/domain and delivery-failure operations are reviewed;
5. expiry, void, resend, download, and evidence-chain drills pass in staging;
6. retention, privacy, participant support, and legal execution policies are
   approved;
7. Production remains empty of test requests and `SIGNING_PUBLIC_ENABLED`
   changes only under a separate launch authorization.
