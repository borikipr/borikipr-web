BEGIN;

ALTER TABLE public.consultas_propiedad
  ADD COLUMN reused_property_buyer_profile_id uuid NULL,
  ADD CONSTRAINT consultas_propiedad_reused_profile_fkey
    FOREIGN KEY (reused_property_buyer_profile_id)
    REFERENCES public.property_buyer_profiles(id)
    ON DELETE RESTRICT,
  ADD CONSTRAINT consultas_propiedad_reused_document_state_check CHECK (
    reused_property_buyer_profile_id IS NULL
    OR (
      lead_id IS NOT NULL
      AND (
        (
          carta_precalificacion_key IS NOT NULL
          AND carta_precalificacion_status = 'uploaded'
          AND evidencia_fondos_key IS NULL
        )
        OR (
          evidencia_fondos_key IS NOT NULL
          AND evidencia_fondos_status = 'uploaded'
          AND carta_precalificacion_key IS NULL
        )
      )
    )
  );

CREATE INDEX consultas_propiedad_reused_profile_idx
  ON public.consultas_propiedad (reused_property_buyer_profile_id)
  WHERE reused_property_buyer_profile_id IS NOT NULL;

COMMIT;
