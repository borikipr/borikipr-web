BEGIN;

-- Presentation-only fields for the authenticated administrator profile.
-- They intentionally do not participate in authorization or session issuance.
ALTER TABLE public.admin_users
  ADD COLUMN professional_title text NULL,
  ADD COLUMN profile_image_url text NULL;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_professional_title_length
  CHECK (professional_title IS NULL OR char_length(btrim(professional_title)) BETWEEN 2 AND 120),
  ADD CONSTRAINT admin_users_profile_image_url_length
  CHECK (profile_image_url IS NULL OR char_length(profile_image_url) <= 2048);

COMMIT;
