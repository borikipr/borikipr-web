BEGIN;

ALTER TABLE public.signature_launch_authorizations
  DROP CONSTRAINT signature_launch_auth_public_scope_check;

ALTER TABLE public.signature_readiness_snapshots
  DROP CONSTRAINT signature_readiness_email_scope_check,
  ADD CONSTRAINT signature_readiness_email_scope_check CHECK (
    cardinality(participant_emails) BETWEEN 1 AND 8
  );

COMMIT;
