BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_module_access) THEN
    RAISE EXCEPTION '0046 rollback blocked: module access grants exist';
  END IF;
END $$;

DROP TABLE public.admin_module_access;

COMMIT;
