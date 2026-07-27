import { sql } from "@/lib/db";
import { generatePrivateShowingToken } from "./private-showing-token";

const ELIGIBLE_STATUSES = new Set([
  "disponible",
  "coming_soon",
  "bajo_contrato",
]);

export async function validatePrivateShowingRoute(
  slug: string,
  suppliedToken: string
) {
  if (
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
    suppliedToken.length < 43 ||
    suppliedToken.length > 200
  ) {
    return false;
  }
  const rows = await sql<{
    private_showing_token: string;
    estado: string;
    origen_listado: string;
    permiso_publicar_web: boolean | null;
  }[]>`
    SELECT private_showing_token, estado, origen_listado, permiso_publicar_web
    FROM public.propiedades
    WHERE slug = ${slug}
    LIMIT 1
  `;
  const property = rows[0];
  if (!property || !constantTimeEqual(suppliedToken, property.private_showing_token)) {
    return false;
  }
  const visible =
    property.origen_listado === "propio" ||
    (isCollaborativeOrigin(property.origen_listado) &&
      property.permiso_publicar_web === true);
  return visible && ELIGIBLE_STATUSES.has(property.estado);
}

export async function getAdminPrivateShowingLink(propertyId: string) {
  const rows = await sql<{ slug: string; private_showing_token: string }[]>`
    SELECT slug, private_showing_token
    FROM public.propiedades
    WHERE id = ${propertyId}::uuid
    LIMIT 1
  `;
  const property = rows[0];
  if (!property) return null;
  return buildPrivateShowingUrl(property.slug, property.private_showing_token);
}

export async function regenerateAdminPrivateShowingLink(propertyId: string) {
  const token = generatePrivateShowingToken();
  const rows = await sql<{ slug: string }[]>`
    UPDATE public.propiedades
    SET private_showing_token = ${token}
    WHERE id = ${propertyId}::uuid
    RETURNING slug
  `;
  return rows[0] ? buildPrivateShowingUrl(rows[0].slug, token) : null;
}

function buildPrivateShowingUrl(slug: string, token: string) {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://borikipr.com";
  return `${base}/listados/${slug}/visita/${token}`;
}

function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function isCollaborativeOrigin(value: string) {
  return ["co_broke", "co-broke", "co broke", "colaboracion", "colaboración"].includes(
    value
  );
}
