import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import {
  isPublicProfessionalProfileEligible,
  normalizeProfessionalBio,
  normalizeProfessionalEmail,
  normalizeProfessionalPhone,
} from "../lib/admin/professional-profile.ts";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("professional profile projection is explicitly bounded", async () => {
  const source = await read("lib/admin/professional-profile.ts");
  const reader = await read("lib/admin/professional-profile-read.ts");
  assert.match(source, /normalizeProfessionalEmail/);
  assert.match(source, /normalizeProfessionalPhone/);
  assert.match(source, /normalizeProfessionalBio/);
  assert.match(reader, /SELECT display_name, professional_title, professional_roles/);
  assert.doesNotMatch(reader, /SELECT \*/);
  for (const field of ["username", "password_hash", "session_version", "system_role", "assigned_broker", "signing_broker", "admin_module_access"]) assert.doesNotMatch(reader, new RegExp(`\\b${field}`));
});

test("professional contact normalizers preserve an explicit professional boundary", () => {
  assert.deepEqual(normalizeProfessionalEmail("  AGENTE@Ejemplo.COM "), { ok: true, value: "agente@ejemplo.com" });
  assert.deepEqual(normalizeProfessionalEmail("not-an-email"), { ok: false, error: "Ingresa un correo profesional válido." });
  assert.deepEqual(normalizeProfessionalPhone("(787) 555-1234"), { ok: true, value: "+17875551234" });
  assert.deepEqual(normalizeProfessionalPhone("+1 787 555 1234"), { ok: true, value: "+17875551234" });
  assert.deepEqual(normalizeProfessionalPhone("555"), { ok: false, error: "Ingresa un teléfono profesional válido." });
  assert.deepEqual(normalizeProfessionalBio("  "), { ok: true, value: null });
  assert.equal(normalizeProfessionalBio("x".repeat(2001)).ok, false);
});

test("public eligibility is explicit and lifecycle-gated", () => {
  const eligible = { activo: true, accountState: "active", publicProfileEnabled: true, approvalState: "approved" };
  assert.equal(isPublicProfessionalProfileEligible(eligible), true);
  assert.equal(isPublicProfessionalProfileEligible({ ...eligible, activo: false }), false);
  assert.equal(isPublicProfessionalProfileEligible({ ...eligible, accountState: "disabled" }), false);
  assert.equal(isPublicProfessionalProfileEligible({ ...eligible, publicProfileEnabled: false }), false);
  assert.equal(isPublicProfessionalProfileEligible({ ...eligible, approvalState: "pending_review" }), false);
});

test("profile mutations retain atomic review and authority safeguards", async () => {
  const account = await read("lib/admin/account.ts");
  const team = await read("lib/admin/team-access.ts");
  const migration = await read("db/migrations/0049_add_professional_profile_foundation.sql");
  assert.match(account, /professional_phone_whatsapp_enabled/);
  assert.match(account, /public_profile_review_invalidated/);
  assert.match(team, /approvePublicProfessionalProfile/);
  assert.match(team, /withdrawPublicProfessionalProfileApproval/);
  assert.match(team, /assertDifferentActor\(actorAdminId, targetAdminId\)/);
  assert.match(migration, /professional_phone_whatsapp_enabled = false OR professional_phone_e164 IS NOT NULL/);
});

test("0049 remains private by default and its guarded rollback will not discard profile data", async () => {
  const [migration, rollback] = await Promise.all([
    read("db/migrations/0049_add_professional_profile_foundation.sql"),
    read("db/migrations/0049_add_professional_profile_foundation.rollback.sql"),
  ]);
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE public.admin_users (id uuid PRIMARY KEY, username text NOT NULL);
    CREATE TABLE public.admin_access_events (
      event_type text NOT NULL CONSTRAINT admin_access_events_type_check CHECK (event_type IN (
        'user_created', 'setup_issued', 'account_activated', 'account_disabled', 'account_reactivated',
        'system_role_changed', 'module_access_granted', 'module_access_revoked',
        'broker_authorization_granted', 'broker_authorization_revoked', 'assigned_broker_changed'
      ))
    );
    INSERT INTO public.admin_users(id, username) VALUES
      ('00000000-0000-0000-0000-000000000001', 'one'),
      ('00000000-0000-0000-0000-000000000002', 'two');
  `);
  await db.exec(migration);
  const defaults = await db.query(`SELECT public_profile_enabled, public_profile_approval_state, professional_email, professional_phone_e164, professional_bio, public_profile_slug FROM public.admin_users ORDER BY username`);
  assert.deepEqual(defaults.rows, [
    { public_profile_enabled: false, public_profile_approval_state: "draft", professional_email: null, professional_phone_e164: null, professional_bio: null, public_profile_slug: null },
    { public_profile_enabled: false, public_profile_approval_state: "draft", professional_email: null, professional_phone_e164: null, professional_bio: null, public_profile_slug: null },
  ]);
  await assert.rejects(db.exec(`UPDATE public.admin_users SET professional_phone_whatsapp_enabled=true WHERE username='one'`));
  await assert.rejects(db.exec(`UPDATE public.admin_users SET public_profile_enabled=true, public_profile_approval_state='approved' WHERE username='one'`));
  await db.exec(`UPDATE public.admin_users SET professional_bio='Datos profesionales' WHERE username='one'`);
  await assert.rejects(db.exec(rollback), /0049 rollback blocked/);
  await db.close();
});
