import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");
const [service, actions, directory, detail, createPage, editPage, form, controls, resetPage, profile] = await Promise.all([
  read("lib/admin/team-access.ts"), read("app/admin/equipo/actions.ts"), read("app/admin/equipo/page.tsx"),
  read("app/admin/equipo/[userId]/page.tsx"), read("app/admin/equipo/nuevo/page.tsx"), read("app/admin/equipo/[userId]/editar/page.tsx"),
  read("app/admin/equipo/TeamMemberForm.tsx"), read("app/admin/equipo/TeamMemberActions.tsx"), read("app/admin/reset-password/page.tsx"), read("app/admin/profile/ProfileForms.tsx"),
]);

test("Team creation is server-authorized, least-privilege, and starts pending setup", () => {
  assert.match(service, /export async function createTeamMember/);
  assert.match(service, /assertActorIsSuperAdmin/);
  assert.match(service, /'pending_setup', false/);
  assert.match(service, /input\.systemRole !== "admin" && input\.systemRole !== "member"/);
  assert.match(service, /eventType: "user_created"/);
  assert.match(service, /placeholderPasswordHash/);
  assert.match(service, /issueAccountSetupToken/);
  assert.match(actions, /requireSuperAdmin/);
});

test("Setup delivery and resend invalidate prior tokens without exposing secrets", () => {
  assert.match(service, /resendTeamSetupInvitation/);
  assert.match(service, /admin_access_setup_resend_state_invalid/);
  assert.match(service, /admin_access_setup_resend_rate_limited/);
  assert.match(service, /revokeExisting/);
  assert.match(service, /SET used_at = COALESCE\(used_at, now\(\)\)/);
  assert.match(service, /eventType: "setup_issued"/);
  assert.match(actions, /created_delivery_failed/);
  assert.doesNotMatch(form + controls + detail, /token_hash|resetUrl|session_version/);
});

test("Professional profile management cannot mutate authorization fields", () => {
  assert.match(service, /updateTeamManagedProfessionalProfile/);
  assert.match(service, /normalizeProfessionalProfile/);
  assert.match(service, /admin_access_team_super_admin_mutation_forbidden/);
  assert.match(form, /RolePicker/);
  assert.match(form, /rolesRequireLicense/);
  assert.doesNotMatch(form, /module grants|broker assignment/i);
});

test("System role controls remain separate and exclude super-admin promotion", () => {
  assert.match(service, /changeTeamManagedSystemRole/);
  assert.match(service, /nextRole !== "admin" && nextRole !== "member"/);
  assert.match(controls, /Cambiar acceso/);
  assert.match(controls, /<option value="member">Miembro/);
  assert.match(controls, /<option value="admin">Administrador/);
  assert.doesNotMatch(form + controls, /<option value="super_admin">/);
  assert.match(service, /eventType: "system_role_changed"/);
});

test("Lifecycle actions preserve the foundation protections and never expose deletion", () => {
  assert.match(controls, /Desactivar cuenta/);
  assert.match(controls, /Reactivar cuenta/);
  assert.match(service, /reactivateAdminAccount/);
  assert.match(service, /account_state = 'pending_setup'/);
  assert.match(service, /session_version = session_version \+ 1/);
  assert.doesNotMatch(directory + detail + controls + actions, /Eliminar usuario|Borrar cuenta|DELETE FROM public\.admin_users/);
});

test("Team pages preserve super-admin-only access, self safety, and purpose-aware setup copy", () => {
  for (const source of [directory, detail, createPage, editPage]) assert.match(source, /requireSuperAdmin\(\)/);
  assert.match(directory, /Añadir miembro/);
  assert.match(detail, /const isSelf/);
  assert.match(detail, /Mi perfil/);
  assert.match(editPage, /access\.user\.id === userId/);
  assert.match(resetPage, /Configurar contraseña/);
  assert.match(profile, /export function RolePicker/);
});
