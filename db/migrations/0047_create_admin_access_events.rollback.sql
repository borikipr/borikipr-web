BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_access_events) THEN
    RAISE EXCEPTION '0047 rollback blocked: immutable access audit history exists';
  END IF;
END $$;

DROP TRIGGER IF EXISTS admin_access_events_immutable_trigger ON public.admin_access_events;
DROP FUNCTION IF EXISTS public.admin_access_events_immutable();
DROP TABLE public.admin_access_events;

COMMIT;
