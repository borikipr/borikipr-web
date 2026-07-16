BEGIN;

DROP INDEX public.consultas_propiedad_lead_showing_event_created_at_idx;
DROP INDEX public.consultas_propiedad_showing_event_created_at_idx;
DROP INDEX public.consultas_propiedad_property_created_at_idx;
DROP INDEX public.consultas_propiedad_lead_created_at_idx;
DROP INDEX public.consultas_propiedad_idempotency_key_uidx;

ALTER TABLE public.consultas_propiedad
  DROP CONSTRAINT consultas_propiedad_evidencia_fondos_status_key_check,
  DROP CONSTRAINT consultas_propiedad_carta_precalificacion_status_key_check,
  DROP CONSTRAINT consultas_propiedad_evidencia_fondos_key_check,
  DROP CONSTRAINT consultas_propiedad_carta_precalificacion_key_check,
  DROP CONSTRAINT consultas_propiedad_evidencia_fondos_status_check,
  DROP CONSTRAINT consultas_propiedad_carta_precalificacion_status_check,
  DROP CONSTRAINT consultas_propiedad_showing_event_key_check,
  DROP CONSTRAINT consultas_propiedad_showing_identity_check,
  DROP CONSTRAINT consultas_propiedad_source_path_check,
  DROP CONSTRAINT consultas_propiedad_lead_id_fkey;

ALTER TABLE public.consultas_propiedad
  DROP COLUMN evidencia_fondos_status,
  DROP COLUMN carta_precalificacion_status,
  DROP COLUMN evidencia_fondos_key,
  DROP COLUMN showing_event_key,
  DROP COLUMN showing_at,
  DROP COLUMN source_path,
  DROP COLUMN idempotency_key,
  DROP COLUMN lead_id;

COMMIT;
