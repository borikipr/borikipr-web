BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.content_translations
    WHERE regeneration_authorized_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Cannot roll back 0020 while translation regeneration authorization is active';
  END IF;
END $$;

ALTER TABLE public.content_translations
  DROP CONSTRAINT content_translations_regeneration_state_check,
  DROP CONSTRAINT content_translations_manual_protection_check;

ALTER TABLE public.content_translations
  ADD CONSTRAINT content_translations_manual_protection_check CHECK (
    origin <> 'manual' OR protected_from_automation = true
  );

ALTER TABLE public.content_translations
  DROP COLUMN regeneration_authorized_at;

COMMIT;
