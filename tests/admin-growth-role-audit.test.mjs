import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { MODULE_KEYS, hasMinimumAccess } from "../lib/admin/access-types.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");

const signatureArtifactRoutes = [
  "app/admin/signatures/[id]/source/route.ts",
  "app/admin/signatures/[id]/pages/[pageIndex]/route.ts",
  "app/admin/signatures/[id]/evidence/route.ts",
  "app/admin/signatures/[id]/certificate/route.ts",
  "app/admin/signatures/[id]/final/route.ts",
];

test("private signing artifacts require signatures.view and preserve 404 non-enumeration", async () => {
  for (const path of signatureArtifactRoutes) {
    const source = await read(path);
    assert.match(source, /requireModuleAccess\("signatures", "view"\)/, path);
    assert.match(source, /status:\s*404/, path);
  }
  const legacySettingsAction = await read("app/admin/signatures/configuracion/actions.ts");
  assert.match(legacySettingsAction, /requireModuleAccess\("signatures", "manage"\)/);
});

test("direct private lead documents and cross-module CTAs honor module access", async () => {
  const [leadDocumentRoute, analyticsPage] = await Promise.all([
    read("app/admin/leads/[id]/documents/[source]/[documentId]/route.ts"),
    read("app/admin/analytics/page.tsx"),
  ]);
  assert.match(leadDocumentRoute, /requireModuleAccess\("leads", "view"\)/);
  assert.match(leadDocumentRoute, /Documento no encontrado\.\", 404/);
  assert.match(analyticsPage, /const canAccessLeads/);
  assert.match(analyticsPage, /\{canAccessLeads \? <Link href="\/admin\/leads"/);
});

test("dashboard keeps profile as a base capability and limits Equipo to super admins", async () => {
  const dashboard = await read("app/admin/page.tsx");
  assert.match(dashboard, /label: "Mi perfil"/);
  assert.match(dashboard, /href: "\/admin\/profile"/);
  assert.match(dashboard, /access\.isSuperAdmin/);
  assert.match(dashboard, /label: "Equipo"/);
  assert.match(dashboard, /href: "\/admin\/equipo"/);
});

test("view/manage semantics are explicit for every grantable business module", () => {
  assert.deepEqual(MODULE_KEYS, ["properties", "leads", "signatures", "testimonials", "analytics"]);
  for (const moduleKey of MODULE_KEYS) {
    assert.equal(hasMinimumAccess(undefined, "view"), false, `${moduleKey}: no grant cannot view`);
    assert.equal(hasMinimumAccess(undefined, "manage"), false, `${moduleKey}: no grant cannot manage`);
    assert.equal(hasMinimumAccess("view", "view"), true, `${moduleKey}: view can read`);
    assert.equal(hasMinimumAccess("view", "manage"), false, `${moduleKey}: view cannot mutate`);
    assert.equal(hasMinimumAccess("manage", "view"), true, `${moduleKey}: manage includes view`);
    assert.equal(hasMinimumAccess("manage", "manage"), true, `${moduleKey}: manage can mutate`);
  }
});

test("page, action, and API guard inventory covers each protected module boundary", async () => {
  const sources = await Promise.all([
    "app/admin/propiedades/layout.tsx", "app/admin/propiedades/actions.ts",
    "app/admin/leads/layout.tsx", "app/admin/leads/[id]/actions.ts", "app/admin/lead-groups/actions.ts",
    "app/admin/signatures/layout.tsx", "app/admin/signatures/actions.ts",
    "app/admin/testimonios/layout.tsx", "app/admin/testimonios/actions.ts",
    "app/admin/analytics/layout.tsx", "app/admin/translations/actions.ts",
    "app/api/admin/upload/route.ts", "app/api/admin/propiedades/[id]/private-showing-link/route.ts",
    "app/api/admin/signatures/drafts/route.ts", "app/api/admin/signatures/templates/[id]/instantiate/route.ts",
  ].map(read));
  const [propertiesLayout, propertiesActions, leadsLayout, leadsActions, leadGroupsActions, signaturesLayout, signaturesActions, testimonialsLayout, testimonialsActions, analyticsLayout, translationsActions, uploadRoute, privateShowingRoute, signatureDraftRoute, templateRoute] = sources;
  assert.match(propertiesLayout, /requireModulePageAccess\("properties"\)/);
  assert.match(propertiesActions, /requireModuleAccess\("properties", "manage"\)/);
  assert.match(leadsLayout, /requireModulePageAccess\("leads"\)/);
  assert.match(leadsActions + leadGroupsActions, /requireModuleAccess\("leads", "manage"\)/);
  assert.match(signaturesLayout, /requireModulePageAccess\("signatures"\)/);
  assert.match(signaturesActions, /requireModuleAccess\("signatures", "manage"\)/);
  assert.match(testimonialsLayout, /requireModulePageAccess\("testimonials"\)/);
  assert.match(testimonialsActions, /requireModuleAccess\("testimonials", "manage"\)/);
  assert.match(analyticsLayout, /requireModulePageAccess\("analytics"\)/);
  assert.match(translationsActions, /requireModuleAccess\(common\.entityType === "property" \? "properties" : "testimonials", "manage"\)/);
  assert.match(uploadRoute, /requireModuleAccess\(purpose === "property" \? "properties" : "testimonials", "manage"\)/);
  assert.match(privateShowingRoute, /requireModuleAccess\("properties", "view"\)/);
  assert.match(privateShowingRoute, /requireModuleAccess\("properties", "manage"\)/);
  assert.match(signatureDraftRoute + templateRoute, /requireModuleAccess\("signatures", "manage"\)/);
});

test("24-user fixture preserves constrained role, lifecycle, grant, broker, and profile foundations", async () => {
  const [m0045, m0046, m0047, m0048, m0049] = await Promise.all([
    read("db/migrations/0045_team_account_lifecycle.sql"),
    read("db/migrations/0046_create_admin_module_access.sql"),
    read("db/migrations/0047_create_admin_access_events.sql"),
    read("db/migrations/0048_add_team_signing_brokers.sql"),
    read("db/migrations/0049_add_professional_profile_foundation.sql"),
  ]);
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY, username text NOT NULL UNIQUE, email text,
      display_name text, professional_roles text[] NOT NULL DEFAULT '{}',
      professional_license_number text, activo boolean NOT NULL DEFAULT true,
      session_version integer NOT NULL DEFAULT 1
    );
    CREATE TABLE public.admin_password_reset_tokens (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      admin_user_id uuid NOT NULL REFERENCES public.admin_users(id),
      token_hash text NOT NULL, expires_at timestamptz NOT NULL,
      used_at timestamptz, email_sent_at timestamptz
    );
    INSERT INTO public.admin_users (id, username, email, display_name, professional_roles, professional_license_number)
    VALUES
      ('3cefce78-7d62-485d-9faa-6fed1b6ae377', 'cedric', 'cedric@example.test', 'Cedric', '{}', NULL),
      ('837a7fca-c067-4878-a4eb-01c12a4cf7ba', 'ivonne', 'ivonne@example.test', 'Ivonne', ARRAY['real_estate_broker'], 'C-12345');
  `);
  for (let index = 1; index <= 22; index += 1) {
    const id = `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`;
    await db.query(`INSERT INTO public.admin_users (id, username, email, display_name) VALUES ($1, $2, $3, $4)`, [id, `fixture-${index}`, `fixture-${index}@example.test`, `Fixture ${index}`]);
  }
  await db.exec(m0045);
  await db.exec(`UPDATE public.admin_users SET system_role='super_admin' WHERE id='3cefce78-7d62-485d-9faa-6fed1b6ae377'`);
  await db.exec(`UPDATE public.admin_users SET system_role='admin' WHERE id='837a7fca-c067-4878-a4eb-01c12a4cf7ba'`);
  await db.exec(m0046); await db.exec(m0047); await db.exec(m0048); await db.exec(m0049);

  const accounts = await db.query(`SELECT count(*)::integer AS count FROM public.admin_users`);
  assert.equal(accounts.rows[0].count, 24);
  await db.exec(`
    INSERT INTO public.admin_module_access (admin_user_id, module_key, access_level, granted_by_admin_user_id)
    VALUES ('00000000-0000-0000-0000-000000000001', 'signatures', 'view', '3cefce78-7d62-485d-9faa-6fed1b6ae377')
  `);
  await assert.rejects(db.exec(`
    INSERT INTO public.admin_module_access (admin_user_id, module_key, access_level, granted_by_admin_user_id)
    VALUES ('00000000-0000-0000-0000-000000000001', 'signatures', 'manage', '3cefce78-7d62-485d-9faa-6fed1b6ae377')
  `));
  await assert.rejects(db.exec(`UPDATE public.admin_users SET account_state='disabled', activo=true WHERE username='fixture-1'`));
  await assert.rejects(db.exec(`UPDATE public.admin_users SET professional_phone_whatsapp_enabled=true WHERE username='fixture-2'`));
  await assert.rejects(db.exec(`UPDATE public.admin_users SET public_profile_enabled=true, public_profile_approval_state='approved' WHERE username='fixture-3'`));
  const broker = await db.query(`SELECT signing_broker_authorized_at IS NOT NULL AS authorized FROM public.admin_users WHERE username='ivonne'`);
  assert.equal(broker.rows[0].authorized, true);
  await db.close();
});
