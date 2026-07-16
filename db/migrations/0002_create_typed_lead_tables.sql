BEGIN;

CREATE TABLE public.property_buyer_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  property_id uuid NOT NULL REFERENCES public.propiedades(id) ON DELETE RESTRICT,
  name_snapshot text NOT NULL,
  email_snapshot text NULL,
  phone_snapshot text NOT NULL,
  purchase_method text NOT NULL,
  purchase_method_other text NULL,
  financial_institution text NULL,
  closing_funds text NULL,
  solar_contract_acceptance text NULL,
  comments text NULL,
  document_type text NULL,
  document_object_key text NULL,
  document_original_name text NULL,
  document_content_type text NULL,
  document_size_bytes bigint NULL,
  document_status text NOT NULL DEFAULT 'none',
  idempotency_key uuid NOT NULL,
  source_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT property_buyer_profiles_purchase_method_check CHECK (
    purchase_method IN ('Financiamiento', 'Cash', 'Otro')
  ),
  CONSTRAINT property_buyer_profiles_solar_contract_acceptance_check CHECK (
    solar_contract_acceptance IS NULL OR solar_contract_acceptance IN ('yes', 'no')
  ),
  CONSTRAINT property_buyer_profiles_document_type_check CHECK (
    document_type IS NULL OR document_type IN ('prequalification_letter', 'proof_of_funds')
  ),
  CONSTRAINT property_buyer_profiles_document_status_check CHECK (
    document_status IN ('none', 'pending', 'uploaded', 'failed')
  ),
  CONSTRAINT property_buyer_profiles_document_size_bytes_check CHECK (
    document_size_bytes IS NULL OR document_size_bytes >= 0
  )
);

CREATE UNIQUE INDEX property_buyer_profiles_idempotency_key_uidx
  ON public.property_buyer_profiles (idempotency_key);

CREATE INDEX property_buyer_profiles_lead_created_at_idx
  ON public.property_buyer_profiles (lead_id, created_at DESC);

CREATE INDEX property_buyer_profiles_property_created_at_idx
  ON public.property_buyer_profiles (property_id, created_at DESC);

CREATE TABLE public.seller_landlord_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  name_snapshot text NOT NULL,
  email_snapshot text NOT NULL,
  phone_snapshot text NOT NULL,
  property_type text NULL,
  location text NULL,
  primary_reason text NULL,
  comments text NULL,
  idempotency_key uuid NOT NULL,
  source_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT seller_landlord_inquiries_property_type_check CHECK (
    property_type IS NULL OR property_type IN (
      'Casa',
      'Apartamento',
      'Terreno',
      'Multifamiliar',
      'Propiedad comercial'
    )
  ),
  CONSTRAINT seller_landlord_inquiries_primary_reason_check CHECK (
    primary_reason IS NULL OR primary_reason IN (
      'Vender',
      'Alquilar',
      'Evaluar ambas opciones'
    )
  )
);

CREATE UNIQUE INDEX seller_landlord_inquiries_idempotency_key_uidx
  ON public.seller_landlord_inquiries (idempotency_key);

CREATE INDEX seller_landlord_inquiries_lead_created_at_idx
  ON public.seller_landlord_inquiries (lead_id, created_at DESC);

CREATE TABLE public.buyer_tenant_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE RESTRICT,
  name_snapshot text NOT NULL,
  email_snapshot text NULL,
  phone_snapshot text NOT NULL,
  primary_interest text NULL,
  purchase_qualification text NULL,
  budget text NULL,
  municipalities text NULL,
  property_types text[] NULL,
  bedrooms text NULL,
  bathrooms text NULL,
  comments text NULL,
  idempotency_key uuid NOT NULL,
  source_path text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT buyer_tenant_inquiries_primary_interest_check CHECK (
    primary_interest IS NULL OR primary_interest IN ('Comprar', 'Alquilar')
  ),
  CONSTRAINT buyer_tenant_inquiries_property_types_check CHECK (
    property_types IS NULL OR property_types <@ ARRAY[
      'Casa',
      'Apartamento',
      'Condominio',
      'Terreno',
      'Propiedad comercial'
    ]::text[]
  ),
  CONSTRAINT buyer_tenant_inquiries_bedrooms_check CHECK (
    bedrooms IS NULL OR bedrooms IN ('1', '2', '3', '4+')
  ),
  CONSTRAINT buyer_tenant_inquiries_bathrooms_check CHECK (
    bathrooms IS NULL OR bathrooms IN ('1', '2', '3+')
  )
);

CREATE UNIQUE INDEX buyer_tenant_inquiries_idempotency_key_uidx
  ON public.buyer_tenant_inquiries (idempotency_key);

CREATE INDEX buyer_tenant_inquiries_lead_created_at_idx
  ON public.buyer_tenant_inquiries (lead_id, created_at DESC);

COMMIT;
