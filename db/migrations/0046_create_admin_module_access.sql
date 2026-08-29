BEGIN;

CREATE TABLE public.admin_module_access (
  admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  module_key text NOT NULL,
  access_level text NOT NULL DEFAULT 'manage',
  granted_by_admin_user_id uuid NOT NULL REFERENCES public.admin_users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (admin_user_id, module_key),
  CONSTRAINT admin_module_access_module_key_check CHECK (
    module_key IN ('properties', 'leads', 'signatures', 'testimonials', 'analytics')
  ),
  CONSTRAINT admin_module_access_level_check CHECK (
    access_level IN ('view', 'manage')
  )
);

CREATE INDEX admin_module_access_lookup_idx
  ON public.admin_module_access (admin_user_id, module_key, access_level);

COMMIT;
