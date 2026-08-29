import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (name) => readFile(`${root}/db/migrations/${name}`, "utf8");
const [m0045, r0045, m0046, r0046, m0047, r0047, auth, account, accessContext, teamAccess, profilePage, brokerCandidates] = await Promise.all([
  read("0045_team_account_lifecycle.sql"), read("0045_team_account_lifecycle.rollback.sql"),
  read("0046_create_admin_module_access.sql"), read("0046_create_admin_module_access.rollback.sql"),
  read("0047_create_admin_access_events.sql"), read("0047_create_admin_access_events.rollback.sql"),
  readFile(`${root}/lib/admin/auth.ts`, "utf8"),
  readFile(`${root}/lib/admin/account.ts`, "utf8"),
  readFile(`${root}/lib/admin/access-context.ts`, "utf8"),
  readFile(`${root}/lib/admin/team-access.ts`, "utf8"),
  readFile(`${root}/app/admin/profile/page.tsx`, "utf8"),
  readFile(`${root}/lib/signatures/broker-candidates.ts`, "utf8"),
]);

test("0045–0047 establish constrained lifecycle, grants, and append-only audit", async () => {
  const db = new PGlite();
  await db.exec(`CREATE TABLE public.admin_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username text NOT NULL UNIQUE,
    activo boolean NOT NULL DEFAULT true, session_version integer NOT NULL DEFAULT 1
  );
  CREATE TABLE public.admin_password_reset_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), admin_user_id uuid NOT NULL REFERENCES public.admin_users(id),
    token_hash text NOT NULL, expires_at timestamptz NOT NULL, used_at timestamptz, email_sent_at timestamptz
  );
  INSERT INTO public.admin_users(username) VALUES ('one'), ('two');`);
  await db.exec(m0045); await db.exec(m0046); await db.exec(m0047);
  const rows = await db.query(`SELECT account_state, system_role, activo FROM public.admin_users ORDER BY username`);
  assert.deepEqual(rows.rows.map((row) => [row.account_state, row.system_role, row.activo]), [["active", "member", true], ["active", "member", true]]);
  await db.exec(`INSERT INTO public.admin_access_events(event_type,target_admin_user_id) SELECT 'user_created', id FROM public.admin_users LIMIT 1`);
  await assert.rejects(db.exec(`UPDATE public.admin_access_events SET event_type='account_disabled'`), /append-only/);
  await assert.rejects(db.exec(`INSERT INTO public.admin_module_access(admin_user_id,module_key,access_level,granted_by_admin_user_id) SELECT id,'invalid','manage',id FROM public.admin_users LIMIT 1`));
  await assert.rejects(db.exec(r0047), /rollback blocked/);
  await db.close();
});

test("foundation retains compatibility and keeps access authority server-side", () => {
  assert.match(m0045, /account_state IN \('pending_setup', 'active', 'disabled'\)/);
  assert.match(m0045, /system_role IN \('super_admin', 'admin', 'member'\)/);
  assert.match(m0045, /account_state = 'active' AND activo = true/);
  assert.match(m0045, /purpose IN \('password_reset', 'account_setup'\)/);
  assert.match(m0047, /BEFORE UPDATE OR DELETE/);
  assert.match(r0045, /rollback blocked/);
  assert.match(r0046, /rollback blocked/);
  assert.match(r0047, /rollback blocked/);
  assert.match(auth, /account_state = 'active'/);
  assert.match(account, /token\.purpose = 'account_setup'/);
  assert.match(account, /account_state = CASE WHEN \$3 = 'account_setup'/);
  assert.match(accessContext, /requireSuperAdmin/);
  assert.match(accessContext, /requireModuleAccess/);
  assert.match(teamAccess, /pg_advisory_xact_lock/);
  assert.match(teamAccess, /admin_access_last_super_admin_forbidden/);
  assert.match(teamAccess, /admin_access_self_mutation_forbidden/);
  assert.match(teamAccess, /INITIAL_SUPER_ADMIN_ID/);
  assert.match(profilePage, /systemRoleLabels/);
  assert.match(brokerCandidates, /admin\.account_state='active'/);
  assert.doesNotMatch(teamAccess, /professional_roles|professional_license_number/);
});
