BEGIN;

DO $rollback_guard$
BEGIN
  IF EXISTS (SELECT 1 FROM public.consultas_propiedad LIMIT 1) THEN
    RAISE EXCEPTION
      '0005_harden_consultas_propiedad rollback requires public.consultas_propiedad to be empty';
  END IF;
END
$rollback_guard$;

ALTER TABLE public.consultas_propiedad
  DROP CONSTRAINT consultas_propiedad_propiedad_id_fkey,
  ALTER COLUMN propiedad_id DROP NOT NULL,
  ADD CONSTRAINT consultas_propiedad_propiedad_id_fkey
    FOREIGN KEY (propiedad_id) REFERENCES public.propiedades(id) ON DELETE CASCADE;

ALTER TABLE public.consultas_propiedad
  ALTER COLUMN created_at DROP DEFAULT,
  ALTER COLUMN created_at TYPE timestamp without time zone
    USING created_at AT TIME ZONE 'UTC',
  ALTER COLUMN created_at SET DEFAULT CURRENT_TIMESTAMP,
  ALTER COLUMN created_at DROP NOT NULL;

COMMIT;
