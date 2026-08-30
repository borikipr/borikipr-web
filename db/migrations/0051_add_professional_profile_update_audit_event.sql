BEGIN;

ALTER TABLE public.admin_access_events
  DROP CONSTRAINT admin_access_events_type_check,
  ADD CONSTRAINT admin_access_events_type_check CHECK (
    event_type IN (
      'user_created', 'setup_issued', 'account_activated', 'account_disabled',
      'account_reactivated', 'system_role_changed', 'module_access_granted',
      'module_access_revoked', 'broker_authorization_granted',
      'broker_authorization_revoked', 'assigned_broker_changed',
      'public_profile_approved', 'public_profile_approval_withdrawn',
      'public_profile_review_invalidated',
      'professional_profile_updated_by_admin'
    )
  );

COMMIT;
