BEGIN;

DO $$
BEGIN
  RAISE EXCEPTION '0035 rollback is intentionally blocked: templates, routing, broker-final evidence, corrections, and date-signed fields require an explicit reviewed forward migration';
END;
$$;

ROLLBACK;
