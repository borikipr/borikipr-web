import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  normalizeProfessionalProfile,
  parseProfessionalRoles,
  professionalRoleTitle,
  rolesRequireLicense,
} from "../lib/admin/professional-profile.ts";

const root = fileURLToPath(new URL("..", import.meta.url));

test("professional roles are bounded, validated, and independent from permissions", () => {
  assert.deepEqual(parseProfessionalRoles('["administrator","community_manager"]'), ["administrator", "community_manager"]);
  assert.equal(parseProfessionalRoles('["administrator","marketing","community_manager"]'), null);
  assert.equal(parseProfessionalRoles('["not-a-role"]'), null);
  assert.equal(rolesRequireLicense(["real_estate_broker"]), true);
  assert.equal(rolesRequireLicense(["administrator"]), false);
  assert.equal(professionalRoleTitle(["administrator", "community_manager"]), "Administrador(a) · Community Manager");
});

test("license is required only for broker and salesperson roles", () => {
  assert.equal(normalizeProfessionalProfile({ roles: '["real_estate_broker"]', customTitle: "", licenseNumber: "" }).ok, false);
  const licensed = normalizeProfessionalProfile({ roles: '["real_estate_salesperson"]', customTitle: "", licenseNumber: "  V-1234  " });
  assert.equal(licensed.ok, true);
  if (licensed.ok) assert.equal(licensed.licenseNumber, "V-1234");
  const nonLicensed = normalizeProfessionalProfile({ roles: '["administrator"]', customTitle: "", licenseNumber: "C-999" });
  assert.equal(nonLicensed.ok, true);
  if (nonLicensed.ok) assert.equal(nonLicensed.licenseNumber, "");
});

test("other preserves a custom professional title", () => {
  const result = normalizeProfessionalProfile({ roles: '["other","marketing"]', customTitle: "Diseño de experiencias", licenseNumber: "" });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.displayTitle, "Diseño de experiencias · Marketing");
});

test("profile UI exposes an accessible capped role combobox and readonly system role", async () => {
  const [profile, css, actions, account, migration] = await Promise.all([
    readFile(`${root}/app/admin/profile/ProfileForms.tsx`, "utf8"),
    readFile(`${root}/app/globals.css`, "utf8"),
    readFile(`${root}/app/admin/profile/actions.ts`, "utf8"),
    readFile(`${root}/lib/admin/account.ts`, "utf8"),
    readFile(`${root}/db/migrations/0044_add_admin_professional_roles.sql`, "utf8"),
  ]);
  assert.match(profile, /role="combobox"/);
  assert.match(profile, /role="listbox"/);
  assert.match(profile, /role="option"/);
  assert.match(profile, /profile-role-toggle/);
  assert.match(profile, /closeOnOutsidePointer/);
  assert.match(profile, /event\.key === " "/);
  assert.match(profile, /Máximo de dos roles profesionales/);
  assert.match(profile, /Número de licencia/);
  assert.match(profile, /Rol del sistema:/);
  assert.doesNotMatch(profile, /name="roleLabel"/);
  assert.match(actions, /professionalRoles/);
  assert.match(account, /normalizeProfessionalProfile/);
  assert.match(account, /professional_roles = \$4::text\[\]/);
  assert.match(migration, /professional_roles text\[\]/);
  assert.match(migration, /professional_license_number text NULL/);
  assert.match(css, /\.profile-role-options \{[^}]*display: flex[^}]*flex-direction: column[^}]*position: absolute[^}]*z-index: 50/s);
  assert.match(css, /\.profile-role-options button \{[^}]*display: flex[^}]*width: 100%/s);
});
