BEGIN;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.lead_group_events LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.lead_group_notes LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.lead_group_members LIMIT 1)
    OR EXISTS (SELECT 1 FROM public.lead_groups LIMIT 1)
  THEN
    RAISE EXCEPTION 'Refusing to roll back lead groups while case data exists';
  END IF;
END
$$;

DROP TABLE public.lead_group_events;
DROP TABLE public.lead_group_notes;
DROP TABLE public.lead_group_members;
DROP TABLE public.lead_groups;

COMMIT;
