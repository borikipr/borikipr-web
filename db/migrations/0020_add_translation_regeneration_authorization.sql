BEGIN;

ALTER TABLE public.content_translations
  ADD COLUMN regeneration_authorized_at timestamptz NULL;

ALTER TABLE public.content_translations
  DROP CONSTRAINT content_translations_manual_protection_check;

ALTER TABLE public.content_translations
  ADD CONSTRAINT content_translations_manual_protection_check CHECK (
    origin <> 'manual'
    OR protected_from_automation = true
    OR regeneration_authorized_at IS NOT NULL
  ),
  ADD CONSTRAINT content_translations_regeneration_state_check CHECK (
    regeneration_authorized_at IS NULL
    OR (
      protected_from_automation = false
      AND review_status = 'unreviewed'
    )
  );

COMMIT;
