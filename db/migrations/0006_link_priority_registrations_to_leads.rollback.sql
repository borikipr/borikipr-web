BEGIN;

DROP INDEX public.property_priority_registrations_lead_id_idx;

ALTER TABLE public.property_priority_registrations
  DROP CONSTRAINT property_priority_registrations_lead_id_fkey;

ALTER TABLE public.property_priority_registrations
  DROP COLUMN lead_id;

COMMIT;
