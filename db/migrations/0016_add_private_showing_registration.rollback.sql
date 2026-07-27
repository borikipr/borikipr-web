BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.consultas_propiedad
    WHERE workflow_source = 'private_showing'
  ) THEN
    RAISE EXCEPTION
      '0016 rollback refused: private Showing registrations exist';
  END IF;
END
$$;

DROP INDEX public.consultas_propiedad_workflow_source_created_idx;

ALTER TABLE public.consultas_propiedad
  DROP CONSTRAINT consultas_propiedad_source_path_check,
  ADD CONSTRAINT consultas_propiedad_source_path_check CHECK (
    source_path IS NULL OR (
      char_length(source_path) BETWEEN 1 AND 500
      AND source_path ~ '^/listados/[a-z0-9-]+/registro-openhouse$'
    )
  ),
  DROP CONSTRAINT consultas_propiedad_workflow_source_check,
  DROP COLUMN workflow_source;

DROP INDEX public.propiedades_private_showing_token_uidx;

ALTER TABLE public.propiedades
  DROP CONSTRAINT propiedades_private_showing_token_length_check,
  DROP COLUMN private_showing_token;

COMMIT;
