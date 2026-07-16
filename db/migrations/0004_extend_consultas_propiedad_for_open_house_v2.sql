BEGIN;

ALTER TABLE public.consultas_propiedad
  ADD COLUMN lead_id uuid NULL,
  ADD COLUMN idempotency_key uuid NULL,
  ADD COLUMN source_path text NULL,
  ADD COLUMN showing_at timestamptz NULL,
  ADD COLUMN showing_event_key text NULL,
  ADD COLUMN evidencia_fondos_key text NULL,
  ADD COLUMN carta_precalificacion_status text NULL,
  ADD COLUMN evidencia_fondos_status text NULL,
  ADD CONSTRAINT consultas_propiedad_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE RESTRICT,
  ADD CONSTRAINT consultas_propiedad_source_path_check CHECK (
    source_path IS NULL OR (
      char_length(source_path) BETWEEN 1 AND 500
      AND source_path ~ '^/listados/[a-z0-9-]+/registro-openhouse$'
    )
  ),
  ADD CONSTRAINT consultas_propiedad_showing_identity_check CHECK (
    (showing_at IS NULL AND showing_event_key IS NULL)
    OR (showing_at IS NOT NULL AND showing_event_key IS NOT NULL)
  ),
  ADD CONSTRAINT consultas_propiedad_showing_event_key_check CHECK (
    showing_event_key IS NULL
    OR char_length(showing_event_key) BETWEEN 1 AND 200
  ),
  ADD CONSTRAINT consultas_propiedad_carta_precalificacion_status_check CHECK (
    carta_precalificacion_status IS NULL
    OR carta_precalificacion_status IN ('none', 'pending', 'uploaded', 'failed')
  ),
  ADD CONSTRAINT consultas_propiedad_evidencia_fondos_status_check CHECK (
    evidencia_fondos_status IS NULL
    OR evidencia_fondos_status IN ('none', 'pending', 'uploaded', 'failed')
  ),
  ADD CONSTRAINT consultas_propiedad_carta_precalificacion_key_check CHECK (
    carta_precalificacion_key IS NULL OR (
      char_length(carta_precalificacion_key) BETWEEN 1 AND 512
      AND left(carta_precalificacion_key, 1) <> '/'
      AND position('..' IN carta_precalificacion_key) = 0
      AND carta_precalificacion_key ~ '^[A-Za-z0-9/_+.-]+$'
    )
  ),
  ADD CONSTRAINT consultas_propiedad_evidencia_fondos_key_check CHECK (
    evidencia_fondos_key IS NULL OR (
      char_length(evidencia_fondos_key) BETWEEN 1 AND 512
      AND left(evidencia_fondos_key, 1) <> '/'
      AND position('..' IN evidencia_fondos_key) = 0
      AND evidencia_fondos_key ~ '^[A-Za-z0-9/_+.-]+$'
    )
  ),
  ADD CONSTRAINT consultas_propiedad_carta_precalificacion_status_key_check CHECK (
    carta_precalificacion_status IS NULL
    OR (carta_precalificacion_status = 'none' AND carta_precalificacion_key IS NULL)
    OR (
      carta_precalificacion_status IN ('pending', 'uploaded', 'failed')
      AND carta_precalificacion_key IS NOT NULL
    )
  ),
  ADD CONSTRAINT consultas_propiedad_evidencia_fondos_status_key_check CHECK (
    evidencia_fondos_status IS NULL
    OR (evidencia_fondos_status = 'none' AND evidencia_fondos_key IS NULL)
    OR (
      evidencia_fondos_status IN ('pending', 'uploaded', 'failed')
      AND evidencia_fondos_key IS NOT NULL
    )
  );

CREATE UNIQUE INDEX consultas_propiedad_idempotency_key_uidx
  ON public.consultas_propiedad (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX consultas_propiedad_lead_created_at_idx
  ON public.consultas_propiedad (lead_id, created_at DESC)
  WHERE lead_id IS NOT NULL;

CREATE INDEX consultas_propiedad_property_created_at_idx
  ON public.consultas_propiedad (propiedad_id, created_at DESC)
  WHERE propiedad_id IS NOT NULL;

CREATE INDEX consultas_propiedad_showing_event_created_at_idx
  ON public.consultas_propiedad (showing_event_key, created_at DESC)
  WHERE showing_event_key IS NOT NULL;

CREATE INDEX consultas_propiedad_lead_showing_event_created_at_idx
  ON public.consultas_propiedad (lead_id, showing_event_key, created_at DESC)
  WHERE lead_id IS NOT NULL AND showing_event_key IS NOT NULL;

COMMIT;
