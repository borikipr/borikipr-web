BEGIN;

ALTER TABLE public.property_priority_registrations
  ADD COLUMN lead_id uuid NULL;

ALTER TABLE public.property_priority_registrations
  ADD CONSTRAINT property_priority_registrations_lead_id_fkey
  FOREIGN KEY (lead_id)
  REFERENCES public.leads(id)
  ON DELETE RESTRICT;

CREATE INDEX property_priority_registrations_lead_id_idx
  ON public.property_priority_registrations (lead_id)
  WHERE lead_id IS NOT NULL;

COMMIT;
