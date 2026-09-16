import type { PublicListingProfessional } from "@/lib/queries/propiedades";

export type PropertyBrochureData = {
  title: string;
  slug: string;
  municipality: string;
  sector: string | null;
  transactionType: "venta" | "renta";
  propertyType: string;
  status: "disponible" | "coming_soon" | "bajo_contrato" | "vendida" | "rentada";
  price: number;
  bedrooms: number;
  bathrooms: number;
  parking: number;
  squareMeters: number;
  description: string;
  featured: boolean;
  canonicalUrl: string;
  imageUrls: string[];
  professional: PublicListingProfessional | null;
};

type PropertyBrochureRow = {
  titulo: string;
  slug: string;
  municipio: string;
  sector_comunidad: string | null;
  tipo_negocio: "venta" | "renta";
  tipo_propiedad: string;
  estado: PropertyBrochureData["status"];
  precio: string | number;
  habitaciones: number;
  banos: number;
  estacionamientos: number;
  metros_cuadrados: number;
  descripcion: string;
  destacado: boolean;
  imagenes: unknown;
  listing_professional: PublicListingProfessional | null;
};

export function mapPropertyBrochureRow(row: PropertyBrochureRow): PropertyBrochureData {
  const imageUrls = Array.isArray(row.imagenes)
    ? row.imagenes.filter((value): value is string => typeof value === "string" && value.length > 0)
    : [];

  return {
    title: row.titulo.trim(),
    slug: row.slug.trim(),
    municipality: row.municipio.trim(),
    sector: row.sector_comunidad?.trim() || null,
    transactionType: row.tipo_negocio,
    propertyType: row.tipo_propiedad.trim(),
    status: row.estado,
    price: Number(row.precio),
    bedrooms: Number(row.habitaciones),
    bathrooms: Number(row.banos),
    parking: Number(row.estacionamientos),
    squareMeters: Number(row.metros_cuadrados),
    description: row.descripcion.trim(),
    featured: Boolean(row.destacado),
    canonicalUrl: `https://borikipr.com/listados/${encodeURIComponent(row.slug.trim())}`,
    imageUrls,
    professional: row.listing_professional ?? null,
  };
}

export async function getPropertyBrochureData(id: string) {
  const { sql } = await import("@/lib/db");
  const rows = await sql<PropertyBrochureRow[]>`
    SELECT
      p.titulo,
      p.slug,
      p.municipio,
      to_jsonb(p)->>'sector_comunidad' AS sector_comunidad,
      p.tipo_negocio,
      p.tipo_propiedad,
      p.estado,
      p.precio,
      p.habitaciones,
      p.banos,
      p.estacionamientos,
      p.metros_cuadrados,
      p.descripcion,
      p.destacado,
      listing_professional.profile AS listing_professional,
      COALESCE(
        json_agg(pi.url ORDER BY pi.orden) FILTER (
          WHERE pi.url IS NOT NULL
            AND (
              p.origen_listado = 'propio'
              OR COALESCE(p.permiso_usar_fotos, false) = true
            )
        ),
        '[]'
      ) AS imagenes
    FROM public.propiedades p
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'displayName', BTRIM(a.display_name),
        'avatarUrl', NULLIF(BTRIM(a.profile_image_url), ''),
        'roleId', CASE
          WHEN 'real_estate_broker' = ANY(a.professional_roles) THEN 'real_estate_broker'
          ELSE 'real_estate_salesperson'
        END,
        'licenseNumber', BTRIM(a.professional_license_number),
        'whatsappPhoneE164', CASE
          WHEN a.professional_phone_whatsapp_enabled = true THEN a.professional_phone_e164
          ELSE NULL
        END
      ) AS profile
      FROM public.admin_users a
      WHERE a.id = p.listing_responsible_user_id
        AND a.activo = true
        AND a.account_state = 'active'
        AND a.public_profile_enabled = true
        AND a.public_profile_approval_state = 'approved'
        AND NULLIF(BTRIM(a.display_name), '') IS NOT NULL
        AND NULLIF(BTRIM(a.professional_license_number), '') IS NOT NULL
        AND (
          'real_estate_broker' = ANY(a.professional_roles)
          OR 'real_estate_salesperson' = ANY(a.professional_roles)
        )
      LIMIT 1
    ) listing_professional ON true
    LEFT JOIN public.propiedad_imagenes pi ON pi.propiedad_id = p.id
    WHERE p.id = ${id}::uuid
      AND (
        p.origen_listado = 'propio'
        OR (
          p.origen_listado IN ('co_broke', 'co-broke', 'co broke', 'colaboracion', 'colaboración')
          AND COALESCE(p.permiso_publicar_web, false) = true
        )
      )
    GROUP BY p.id, listing_professional.profile
    LIMIT 1
  `;

  return rows[0] ? mapPropertyBrochureRow(rows[0]) : null;
}
