BEGIN;

ALTER TABLE public.consultas_propiedad
  DROP CONSTRAINT consultas_propiedad_reused_document_state_check,
  DROP CONSTRAINT consultas_propiedad_reused_profile_fkey;

DROP INDEX public.consultas_propiedad_reused_profile_idx;

ALTER TABLE public.consultas_propiedad
  DROP COLUMN reused_property_buyer_profile_id;

COMMIT;
