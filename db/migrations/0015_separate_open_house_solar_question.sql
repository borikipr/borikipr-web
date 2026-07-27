BEGIN;

ALTER TABLE public.propiedades
  ADD COLUMN open_house_solar_question_enabled boolean NOT NULL DEFAULT false;

COMMIT;
