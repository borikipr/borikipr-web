BEGIN;

DO $$
BEGIN
  RAISE EXCEPTION '0036 rollback is intentionally blocked: historical governance effective dates may already be validly recorded';
END;
$$;

ROLLBACK;
