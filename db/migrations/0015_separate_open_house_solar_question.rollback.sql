BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.propiedades
    WHERE open_house_solar_question_enabled IS TRUE
  ) THEN
    RAISE EXCEPTION
      '0015 rollback refused: Open House solar-question configuration exists';
  END IF;
END
$$;

ALTER TABLE public.propiedades
  DROP COLUMN open_house_solar_question_enabled;

COMMIT;
