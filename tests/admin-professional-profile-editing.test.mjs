import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");

test("self professional editing is separated from sensitive account email", async () => {
  const [actions, account, form] = await Promise.all([
    read("app/admin/profile/actions.ts"), read("lib/admin/account.ts"), read("app/admin/profile/ProfileForms.tsx"),
  ]);
  assert.match(actions, /updateProfessionalProfile/);
  assert.match(actions, /updateAccountEmail/);
  assert.match(account, /updateOwnProfessionalProfile/);
  assert.match(account, /updateOwnAdminEmail/);
  assert.match(account, /bcrypt\.compare\(currentPassword/);
  assert.match(form, /Actualizar correo de acceso/);
  assert.match(form, /updateProfessionalProfile/);
  assert.doesNotMatch(account.match(/export async function updateOwnProfessionalProfile[\s\S]*?(?=export async function updateOwnAdminEmail)/)?.[0] ?? "", /currentPassword/);
});

test("self public-profile consent uses the Admin switch language without changing its form contract", async () => {
  const form = await read("app/admin/profile/ProfileForms.tsx");
  assert.match(form, /name="publicProfileEnabled"/);
  assert.match(form, /type="checkbox"/);
  assert.match(form, /role="switch"/);
  assert.match(form, /checked=\{publicEnabled\}/);
  assert.match(form, /aria-checked=\{publicEnabled\}/);
  assert.match(form, /aria-label="Habilitar perfil profesional para áreas públicas"/);
  assert.match(form, /peer-focus-visible:ring-2/);
  assert.match(form, /Perfil profesional público/);
  assert.match(form, /Habilitar para áreas públicas/);
});

test("Team professional editor is dedicated, narrow, and lifecycle aware", async () => {
  const [page, form, actions, service] = await Promise.all([
    read("app/admin/equipo/[userId]/perfil-profesional/page.tsx"), read("app/admin/equipo/TeamProfessionalProfileForm.tsx"),
    read("app/admin/equipo/actions.ts"), read("lib/admin/team-access.ts"),
  ]);
  assert.match(page, /requireSuperAdmin/);
  assert.match(page, /redirect\("\/admin\/profile"\)/);
  assert.match(form, /Solicitud de perfil público/);
  assert.doesNotMatch(form, /name="publicProfileEnabled"/);
  assert.match(form, /Esta cuenta está deshabilitada/);
  assert.match(actions, /updateTeamProfessionalProfileAction/);
  assert.match(service, /updateTeamProfessionalProfileByAdmin/);
  assert.match(service, /FOR UPDATE/);
  assert.match(service, /admin_access_professional_target_disabled/);
  const mutation = service.match(/export async function updateTeamProfessionalProfileByAdmin[\s\S]*?(?=\nexport async function approvePublicProfessionalProfile)/)?.[0] ?? "";
  for (const forbidden of ["system_role=", "assigned_broker", "signing_broker_authorized", "\\n\\s+email =", "public_profile_enabled="]) assert.doesNotMatch(mutation, new RegExp(forbidden));
});

test("on-behalf uploads require a dedicated target-bound purpose", async () => {
  const route = await read("app/api/admin/upload/route.ts");
  assert.match(route, /purpose === "team-profile"/);
  assert.match(route, /requireSuperAdmin/);
  assert.match(route, /targetId/);
  assert.match(route, /target\[0\]\.account_state === "disabled"/);
  assert.match(route, /purpose === "profile" \|\| purpose === "team-profile" \? "perfiles"/);
});

test("0051 extends only the append-only audit event allowlist and rolls back fail-closed", async () => {
  const [migration, rollback, types] = await Promise.all([
    read("db/migrations/0051_add_professional_profile_update_audit_event.sql"),
    read("db/migrations/0051_add_professional_profile_update_audit_event.rollback.sql"), read("lib/admin/access-types.ts"),
  ]);
  assert.match(migration, /professional_profile_updated_by_admin/);
  assert.doesNotMatch(migration, /ADD COLUMN|CREATE TABLE/);
  assert.match(rollback, /0051 rollback blocked/);
  assert.match(types, /professional_profile_updated_by_admin/);
});

test("existing admin self-save accepts canonical E.164 and commits without account or admin-audit mutation", async () => {
  const [foundation, fix, rollback] = await Promise.all([
    read("db/migrations/0049_add_professional_profile_foundation.sql"),
    read("db/migrations/0052_fix_professional_phone_e164_constraint.sql"),
    read("db/migrations/0052_fix_professional_phone_e164_constraint.rollback.sql"),
  ]);
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE,
      email text NULL,
      activo boolean NOT NULL DEFAULT true,
      account_state text NOT NULL DEFAULT 'active',
      display_name text NULL,
      professional_title text NULL,
      professional_roles text[] NOT NULL DEFAULT '{}'::text[],
      professional_license_number text NULL,
      profile_image_url text NULL
    );
    CREATE TABLE public.admin_access_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      occurred_at timestamptz NOT NULL DEFAULT now(),
      event_type text NOT NULL,
      actor_admin_user_id uuid NULL REFERENCES public.admin_users(id),
      target_admin_user_id uuid NOT NULL REFERENCES public.admin_users(id),
      metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
      CONSTRAINT admin_access_events_type_check CHECK (event_type IN (
        'user_created','setup_issued','account_activated','account_disabled','account_reactivated',
        'system_role_changed','module_access_granted','module_access_revoked',
        'broker_authorization_granted','broker_authorization_revoked','assigned_broker_changed'
      ))
    );
    INSERT INTO public.admin_users (
      id, username, email, display_name, professional_title,
      professional_roles, professional_license_number
    ) VALUES (
      '837a7fca-c067-4878-a4eb-01c12a4cf7ba', 'existing-admin',
      'account@example.test', 'Existing Admin',
      'Corredor(a) de Bienes Raíces · Marketing',
      ARRAY['real_estate_broker','marketing'], 'C-25961'
    );
  `);
  await db.exec(foundation);

  await assert.rejects(
    db.exec(`UPDATE public.admin_users SET professional_phone_e164 = '+17876774900' WHERE username = 'existing-admin'`),
    /admin_users_professional_phone_e164_check/,
  );

  await db.exec(fix);
  await db.transaction(async (transaction) => {
    await transaction.query(
      `UPDATE public.admin_users
          SET display_name = $2,
              professional_title = $3,
              professional_roles = $4::text[],
              professional_license_number = NULLIF($5, ''),
              professional_email = $6,
              professional_phone_e164 = $7,
              professional_phone_whatsapp_enabled = $8,
              professional_bio = $9,
              public_profile_enabled = false,
              public_profile_approval_state = 'disabled',
              public_profile_approved_at = NULL,
              public_profile_approved_by_admin_id = NULL
        WHERE id = $1::uuid AND activo = true AND account_state = 'active'`,
      [
        "837a7fca-c067-4878-a4eb-01c12a4cf7ba",
        "Existing Admin",
        "Corredor(a) de Bienes Raíces · Marketing",
        ["real_estate_broker", "marketing"],
        "C-25961",
        "professional@example.test",
        "+17876774900",
        true,
        "Perfil profesional de prueba.",
      ],
    );
  });

  const result = await db.query(`
    SELECT email, professional_phone_e164, professional_phone_whatsapp_enabled,
           public_profile_approval_state,
           (SELECT count(*)::int FROM public.admin_access_events
             WHERE event_type = 'professional_profile_updated_by_admin') AS admin_audit_count
      FROM public.admin_users
     WHERE username = 'existing-admin'
  `);
  assert.deepEqual(result.rows, [{
    email: "account@example.test",
    professional_phone_e164: "+17876774900",
    professional_phone_whatsapp_enabled: true,
    public_profile_approval_state: "disabled",
    admin_audit_count: 0,
  }]);
  await assert.rejects(db.exec(rollback), /0052 rollback blocked/);
  await db.close();
});

test("self WhatsApp preference remains authoritative through write, read, and post-action form state", async () => {
  const [actions, account, auth, page, form] = await Promise.all([
    read("app/admin/profile/actions.ts"),
    read("lib/admin/account.ts"),
    read("lib/admin/auth.ts"),
    read("app/admin/profile/page.tsx"),
    read("app/admin/profile/ProfileForms.tsx"),
  ]);

  assert.match(actions, /professionalPhoneWhatsappEnabled:\s*result\.professionalPhoneWhatsappEnabled/);
  assert.match(account, /professional_phone_whatsapp_enabled\s*=\s*\$9/);
  assert.match(account, /professionalPhoneWhatsappEnabled:\s*nextProfessionalPhoneWhatsappEnabled/);
  assert.match(auth, /professionalPhoneWhatsappEnabled:\s*row\.professional_phone_whatsapp_enabled/);
  assert.match(page, /whatsappEnabled=\{admin\.professionalPhoneWhatsappEnabled\}/);
  assert.match(form, /profileState\.professionalPhoneWhatsappEnabled\s*\?\?/);
  assert.match(form, /checked=\{whatsappEnabledState\}/);

  const db = new PGlite();
  await db.exec(`
    CREATE TABLE profile_fixture (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      professional_phone_e164 text NULL,
      professional_phone_whatsapp_enabled boolean NOT NULL DEFAULT false,
      CONSTRAINT whatsapp_requires_phone CHECK (
        professional_phone_whatsapp_enabled = false OR professional_phone_e164 IS NOT NULL
      )
    );
    INSERT INTO profile_fixture (professional_phone_e164, professional_phone_whatsapp_enabled)
    VALUES ('+17875551234', false);
  `);

  await db.query(`UPDATE profile_fixture SET professional_phone_whatsapp_enabled = true`);
  let row = (await db.query(`SELECT professional_phone_e164, professional_phone_whatsapp_enabled FROM profile_fixture`)).rows[0];
  assert.deepEqual(row, { professional_phone_e164: "+17875551234", professional_phone_whatsapp_enabled: true });

  await db.query(`UPDATE profile_fixture SET professional_phone_whatsapp_enabled = false`);
  row = (await db.query(`SELECT professional_phone_e164, professional_phone_whatsapp_enabled FROM profile_fixture`)).rows[0];
  assert.deepEqual(row, { professional_phone_e164: "+17875551234", professional_phone_whatsapp_enabled: false });

  await db.query(`UPDATE profile_fixture SET professional_phone_e164 = NULL, professional_phone_whatsapp_enabled = false`);
  row = (await db.query(`SELECT professional_phone_e164, professional_phone_whatsapp_enabled FROM profile_fixture`)).rows[0];
  assert.deepEqual(row, { professional_phone_e164: null, professional_phone_whatsapp_enabled: false });
  await assert.rejects(
    db.query(`UPDATE profile_fixture SET professional_phone_whatsapp_enabled = true`),
    /whatsapp_requires_phone/,
  );
  await db.close();
});
