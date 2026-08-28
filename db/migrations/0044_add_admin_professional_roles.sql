BEGIN;

-- Presentation-only professional metadata. It intentionally does not affect
-- authorization, sessions, or the system role of an administrator.
ALTER TABLE public.admin_users
  ADD COLUMN professional_roles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN professional_license_number text NULL;

UPDATE public.admin_users
SET professional_roles = CASE lower(btrim(coalesce(professional_title, '')))
  WHEN 'corredor(a) de bienes raíces' THEN ARRAY['real_estate_broker']
  WHEN 'corredor de bienes raíces' THEN ARRAY['real_estate_broker']
  WHEN 'corredora de bienes raíces' THEN ARRAY['real_estate_broker']
  WHEN 'vendedor(a) de bienes raíces' THEN ARRAY['real_estate_salesperson']
  WHEN 'vendedor de bienes raíces' THEN ARRAY['real_estate_salesperson']
  WHEN 'vendedora de bienes raíces' THEN ARRAY['real_estate_salesperson']
  WHEN 'administrador(a)' THEN ARRAY['administrator']
  WHEN 'administrador' THEN ARRAY['administrator']
  WHEN 'administradora' THEN ARRAY['administrator']
  WHEN 'community manager' THEN ARRAY['community_manager']
  WHEN 'desarrollo web' THEN ARRAY['web_development']
  WHEN 'tecnología y sistemas' THEN ARRAY['technology_systems']
  WHEN 'tecnologia y sistemas' THEN ARRAY['technology_systems']
  WHEN 'marketing' THEN ARRAY['marketing']
  WHEN 'asistente administrativo' THEN ARRAY['administrative_assistant']
  WHEN 'coordinación de transacciones' THEN ARRAY['transaction_coordination']
  WHEN 'coordinacion de transacciones' THEN ARRAY['transaction_coordination']
  WHEN '' THEN '{}'::text[]
  ELSE ARRAY['other']
END
WHERE professional_title IS NOT NULL;

ALTER TABLE public.admin_users
  ADD CONSTRAINT admin_users_professional_roles_check CHECK (
    cardinality(professional_roles) <= 2
    AND professional_roles <@ ARRAY[
      'real_estate_broker', 'real_estate_salesperson', 'administrator',
      'community_manager', 'web_development', 'technology_systems',
      'marketing', 'administrative_assistant', 'transaction_coordination', 'other'
    ]::text[]
  ),
  ADD CONSTRAINT admin_users_professional_license_number_length
    CHECK (professional_license_number IS NULL OR char_length(btrim(professional_license_number)) BETWEEN 1 AND 80);

COMMIT;
