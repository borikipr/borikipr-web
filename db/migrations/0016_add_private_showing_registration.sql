BEGIN;

ALTER TABLE public.propiedades
  ADD COLUMN private_showing_token text;

UPDATE public.propiedades
SET private_showing_token =
  replace(gen_random_uuid()::text, '-', '')
  || replace(gen_random_uuid()::text, '-', '')
WHERE private_showing_token IS NULL;

ALTER TABLE public.propiedades
  ALTER COLUMN private_showing_token SET NOT NULL,
  ADD CONSTRAINT propiedades_private_showing_token_length_check
    CHECK (char_length(private_showing_token) >= 43);

CREATE UNIQUE INDEX propiedades_private_showing_token_uidx
  ON public.propiedades (private_showing_token);

ALTER TABLE public.consultas_propiedad
  ADD COLUMN workflow_source text NOT NULL DEFAULT 'open_house',
  ADD CONSTRAINT consultas_propiedad_workflow_source_check
    CHECK (workflow_source IN ('open_house', 'private_showing'));

ALTER TABLE public.consultas_propiedad
  DROP CONSTRAINT consultas_propiedad_source_path_check,
  ADD CONSTRAINT consultas_propiedad_source_path_check CHECK (
    source_path IS NULL OR (
      char_length(source_path) BETWEEN 1 AND 500
      AND source_path ~ '^/listados/[a-z0-9-]+/(registro-openhouse|visita)$'
    )
  );

CREATE INDEX consultas_propiedad_workflow_source_created_idx
  ON public.consultas_propiedad (workflow_source, created_at DESC);

COMMIT;
