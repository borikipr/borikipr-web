import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
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
