import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

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
