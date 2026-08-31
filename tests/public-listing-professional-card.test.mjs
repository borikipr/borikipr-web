import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const source = (file) => readFile(path.join(root, file), "utf8");

test("public property detail resolves one bounded fail-closed professional projection", async () => {
  const query = await source("lib/queries/propiedades.ts");
  const detail = query.match(/const getCachedPropiedadBySlug[\s\S]*?\["public-property-by-slug"\]/)?.[0] ?? "";

  assert.match(detail, /LEFT JOIN LATERAL/);
  assert.match(detail, /a\.id = p\.listing_responsible_user_id/);
  assert.match(detail, /a\.activo = true/);
  assert.match(detail, /a\.account_state = 'active'/);
  assert.match(detail, /a\.public_profile_enabled = true/);
  assert.match(detail, /a\.public_profile_approval_state = 'approved'/);
  assert.match(detail, /'real_estate_broker' = ANY\(a\.professional_roles\)/);
  assert.match(detail, /'real_estate_salesperson' = ANY\(a\.professional_roles\)/);
  assert.match(detail, /NULLIF\(BTRIM\(a\.professional_license_number\), ''\) IS NOT NULL/);
  assert.match(detail, /LIMIT 1/);
  assert.doesNotMatch(detail, /SELECT\s+a\.\*|SELECT\s+\*/);
});

test("eligible broker and salesperson project while every ineligible fixture stays hidden", async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE admin_users (
      id text PRIMARY KEY,
      activo boolean NOT NULL,
      account_state text NOT NULL,
      display_name text,
      profile_image_url text,
      professional_roles text[] NOT NULL DEFAULT '{}',
      professional_license_number text,
      professional_phone_e164 text,
      professional_phone_whatsapp_enabled boolean NOT NULL DEFAULT false,
      public_profile_enabled boolean NOT NULL DEFAULT false,
      public_profile_approval_state text NOT NULL DEFAULT 'draft'
    );
    CREATE TABLE propiedades (slug text PRIMARY KEY, listing_responsible_user_id text);
    INSERT INTO admin_users VALUES
      ('broker', true, 'active', 'Broker Eligible', '/broker.jpg', ARRAY['marketing','real_estate_broker'], 'C-100', '+17875551000', true, true, 'approved'),
      ('sales', true, 'active', 'Sales Eligible', NULL, ARRAY['real_estate_salesperson'], 'V-200', '+17875552000', false, true, 'approved'),
      ('disabled', false, 'disabled', 'Disabled', NULL, ARRAY['real_estate_broker'], 'C-300', NULL, false, true, 'approved'),
      ('opted-out', true, 'active', 'Opted Out', NULL, ARRAY['real_estate_broker'], 'C-400', NULL, false, false, 'disabled'),
      ('draft', true, 'active', 'Draft', NULL, ARRAY['real_estate_broker'], 'C-500', NULL, false, true, 'draft'),
      ('pending', true, 'active', 'Pending', NULL, ARRAY['real_estate_broker'], 'C-600', NULL, false, true, 'pending_review'),
      ('no-role', true, 'active', 'No Role', NULL, ARRAY['marketing'], 'M-700', NULL, false, true, 'approved'),
      ('no-license', true, 'active', 'No License', NULL, ARRAY['real_estate_broker'], NULL, NULL, false, true, 'approved');
    INSERT INTO propiedades VALUES
      ('null-assignment', NULL), ('missing-target', 'missing'), ('broker-visible', 'broker'),
      ('sales-visible', 'sales'), ('disabled-hidden', 'disabled'), ('opted-out-hidden', 'opted-out'),
      ('draft-hidden', 'draft'), ('pending-hidden', 'pending'), ('no-role-hidden', 'no-role'),
      ('no-license-hidden', 'no-license');
  `);

  const result = await db.query(`
    SELECT p.slug, professional.profile
    FROM propiedades p
    LEFT JOIN LATERAL (
      SELECT jsonb_build_object(
        'displayName', BTRIM(a.display_name),
        'avatarUrl', NULLIF(BTRIM(a.profile_image_url), ''),
        'roleId', CASE WHEN 'real_estate_broker' = ANY(a.professional_roles)
          THEN 'real_estate_broker' ELSE 'real_estate_salesperson' END,
        'licenseNumber', BTRIM(a.professional_license_number),
        'whatsappPhoneE164', CASE WHEN a.professional_phone_whatsapp_enabled
          THEN a.professional_phone_e164 ELSE NULL END
      ) AS profile
      FROM admin_users a
      WHERE a.id = p.listing_responsible_user_id
        AND a.activo = true AND a.account_state = 'active'
        AND a.public_profile_enabled = true
        AND a.public_profile_approval_state = 'approved'
        AND NULLIF(BTRIM(a.display_name), '') IS NOT NULL
        AND NULLIF(BTRIM(a.professional_license_number), '') IS NOT NULL
        AND ('real_estate_broker' = ANY(a.professional_roles)
          OR 'real_estate_salesperson' = ANY(a.professional_roles))
      LIMIT 1
    ) professional ON true
    ORDER BY p.slug
  `);

  const bySlug = Object.fromEntries(result.rows.map((row) => [row.slug, row.profile]));
  assert.deepEqual(bySlug["broker-visible"], {
    displayName: "Broker Eligible", avatarUrl: "/broker.jpg", roleId: "real_estate_broker",
    licenseNumber: "C-100", whatsappPhoneE164: "+17875551000",
  });
  assert.deepEqual(bySlug["sales-visible"], {
    displayName: "Sales Eligible", avatarUrl: null, roleId: "real_estate_salesperson",
    licenseNumber: "V-200", whatsappPhoneE164: null,
  });
  for (const slug of [
    "null-assignment", "missing-target", "disabled-hidden", "opted-out-hidden",
    "draft-hidden", "pending-hidden", "no-role-hidden", "no-license-hidden",
  ]) assert.equal(bySlug[slug], null, slug);
  await db.close();
});

test("projection contains only compact presentation data and prioritizes broker", async () => {
  const query = await source("lib/queries/propiedades.ts");
  const projection = query.match(/SELECT jsonb_build_object\(([\s\S]*?)\) AS profile/)?.[1] ?? "";

  for (const key of ["displayName", "avatarUrl", "roleId", "licenseNumber", "whatsappPhoneE164"]) {
    assert.match(projection, new RegExp(`'${key}'`));
  }
  assert.match(projection, /WHEN 'real_estate_broker' = ANY[\s\S]*ELSE 'real_estate_salesperson'/);
  for (const forbidden of [
    "username", "email", "recovery", "system_role", "module", "session_version",
    "password", "assigned_broker", "signing_broker", "public_profile_slug", "professional_bio",
  ]) {
    assert.doesNotMatch(projection, new RegExp(forbidden));
  }
});

test("listing professional card remains compact, accessible, and profile-link free", async () => {
  const [component, page] = await Promise.all([
    source("components/ListingProfessionalCard.tsx"),
    source("app/(public)/listados/[slug]/page.tsx"),
  ]);

  assert.match(component, /aria-labelledby="listing-professional-heading"/);
  assert.match(component, /role="img"/);
  assert.match(component, /aria-label=\{photoAlt\}/);
  assert.match(component, /h-14 w-14/);
  assert.doesNotMatch(component, /<Link|href=|professionalBio|email|phone/);
  assert.match(page, /<ListingProfessionalCard/);
  assert.match(page, /listing_professional_card/);
  assert.match(page, /professionalWhatsappPhone\.slice\(1\)/);
  assert.doesNotMatch(page, /\/agentes|Ver perfil|View profile/);
});

test("professional WhatsApp is conditional, server-built, and keeps property context", async () => {
  const page = await source("app/(public)/listados/[slug]/page.tsx");
  assert.match(page, /professionalWhatsappPhone && \/\^\\\+\[1-9\]\\d\{7,14\}\$\//);
  assert.match(page, /professionalWhatsappUrl = [\s\S]*whatsappMensaje/);
  assert.match(page, /professionalWhatsappUrl \|\| !propiedad\.listingProfessional/);
  assert.match(page, /professionalWhatsappUrl \?\? whatsappUrl/);
  assert.match(page, /ctaLocation=\{propiedad\.listingProfessional \? "listing_professional_card" : "property_detail"\}/);
});

test("privacy-sensitive mutations expire the public property cache immediately", async () => {
  const [selfActions, teamActions, propertyActions, activationActions] = await Promise.all([
    source("app/admin/profile/actions.ts"),
    source("app/admin/equipo/actions.ts"),
    source("app/admin/propiedades/actions.ts"),
    source("app/admin/reset-password/actions.ts"),
  ]);

  assert.match(selfActions, /updateTag\(PUBLIC_PROPERTIES_CACHE_TAG\)/);
  assert.match(teamActions, /function invalidatePublicProperties\(\)[\s\S]*updateTag\(PUBLIC_PROPERTIES_CACHE_TAG\)/);
  assert.match(propertyActions, /function revalidatePublicProperties\(\)[\s\S]*updateTag\(PUBLIC_PROPERTIES_CACHE_TAG\)/);
  assert.match(activationActions, /updateTag\(PUBLIC_PROPERTIES_CACHE_TAG\)/);
  assert.doesNotMatch(propertyActions, /revalidateTag\(PUBLIC_PROPERTIES_CACHE_TAG/);
});

test("localized card copy exists in both public dictionaries", async () => {
  const [es, en] = await Promise.all([source("locales/es-PR.ts"), source("locales/en-US.ts")]);
  for (const dictionary of [es, en]) {
    for (const key of [
      "listingProfessionalSection", "listingProfessionalBroker", "listingProfessionalSalesperson",
      "licenseLabel", "professionalPhotoAlt", "contact", "whatsappAccessible",
    ]) {
      assert.match(dictionary, new RegExp(`${key}:`));
    }
  }
});
