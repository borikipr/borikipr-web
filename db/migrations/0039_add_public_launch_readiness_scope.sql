BEGIN;

ALTER TABLE public.signature_readiness_snapshots
  DROP CONSTRAINT signature_readiness_email_scope_check,
  ADD CONSTRAINT signature_readiness_email_scope_check CHECK (
    (authorization_type='internal_canary' AND cardinality(participant_emails) BETWEEN 1 AND 8)
    OR (authorization_type='production_public_launch' AND cardinality(participant_emails)=0)
  );

ALTER TABLE public.signature_launch_authorizations
  ADD CONSTRAINT signature_launch_auth_public_scope_check CHECK (
    authorization_type<>'production_public_launch'
    OR environment<>'production'
    OR phase2o_legacy
    OR (
      readiness_snapshot_id IS NOT NULL
      AND authorized_participant_scope='[]'::jsonb
      AND cardinality(authorized_participant_emails)=0
      AND cardinality(authorized_document_types) BETWEEN 1 AND 20
      AND cardinality(authorized_locales) BETWEEN 1 AND 2
      AND authorized_locales <@ ARRAY['es-PR','en-US']::text[]
      AND expires_at IS NULL
    )
  );

COMMIT;
