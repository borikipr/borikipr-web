import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");
const [directory, detail, repository, nav, meta, avatar] = await Promise.all([
  read("app/admin/equipo/page.tsx"),
  read("app/admin/equipo/[userId]/page.tsx"),
  read("lib/admin/team-directory.ts"),
  read("components/admin/AdminNav.tsx"),
  read("components/admin/TeamMemberMeta.tsx"),
  read("components/admin/TeamMemberAvatar.tsx"),
]);

test("Equipo directory and detail enforce the super-admin boundary", () => {
  assert.match(directory, /requireSuperAdmin\(\)/);
  assert.match(detail, /requireSuperAdmin\(\)/);
  assert.match(directory, /redirect\("\/admin"\)/);
  assert.match(detail, /UUID_PATTERN/);
  assert.match(detail, /notFound\(\)/);
  assert.match(nav, /showTeam/);
  assert.match(nav, /teamNavItem/);
});

test("Equipo presents human-readable identity without sensitive account internals", () => {
  assert.match(meta, /systemRoleLabels/);
  assert.match(meta, /Pendiente de configuración/);
  assert.match(meta, /Lic\. \{member\.professionalLicenseNumber\}/);
  assert.match(avatar, /Foto de perfil de/);
  assert.match(directory, /Todavía no hay miembros en el equipo/);
  assert.doesNotMatch(directory + detail, /Nuevo usuario|Invitar usuario|Desactivar|Reactivar|Cambiar estado|module_access/);
  assert.doesNotMatch(directory + detail, /session_version|password_hash|token_hash|admin_access_events/);
});

test("Team read model is bounded and reuses existing professional identity data", () => {
  assert.match(repository, /FROM public\.admin_users/);
  assert.match(repository, /professional_roles/);
  assert.match(repository, /professional_license_number/);
  assert.match(repository, /profile_image_url/);
  assert.match(repository, /parseProfessionalRoles/);
  const professionalEditorQuery = repository.match(/export const getTeamProfessionalEditorTarget[\s\S]*/)?.[0] ?? "";
  assert.match(professionalEditorQuery, /professional_email/);
  assert.match(professionalEditorQuery, /professional_phone_e164/);
  assert.doesNotMatch(professionalEditorQuery, /admin_module_access|admin_access_events|password_hash|token_hash|system_role|assigned_broker/);
});
