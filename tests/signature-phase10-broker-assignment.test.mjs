import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const source = (file) => readFile(path.join(process.cwd(), file), "utf8");

test("broker candidates resolve through the explicit Team authorization source", async () => {
  const { listSignatureBrokerCandidates, resolveSignatureBrokerCandidate } =
    await import("../lib/signatures/broker-candidates.ts");
  const candidates = await listSignatureBrokerCandidates({
    unsafe: async () => [{ id: "broker-1", name: "Ivonne Erickson", email: "IVONNE@example.test", license_number: "C-1" }],
  });
  assert.deepEqual(candidates, [{ id: "broker-1", name: "Ivonne Erickson", email: "ivonne@example.test", licenseNumber: "C-1" }]);
  assert.deepEqual(
    await resolveSignatureBrokerCandidate({ unsafe: async () => candidates }, null),
    candidates[0],
  );
  assert.equal(
    await resolveSignatureBrokerCandidate({ unsafe: async () => candidates }, "not-authorized"),
    null,
  );
  const multiple = [...candidates, { id: "broker-2", name: "Otro corredor", email: "otro@example.test", licenseNumber: "C-2" }];
  assert.equal(
    await resolveSignatureBrokerCandidate({ unsafe: async () => multiple }, null),
    null,
  );
  assert.deepEqual(
    await resolveSignatureBrokerCandidate({ unsafe: async () => multiple }, "broker-2"),
    multiple[1],
  );
});

test("restricted member broker resolution is bounded to self or its assigned broker", async () => {
  const { listSignatureBrokerCandidates, resolveSignatureBrokerCandidate } =
    await import("../lib/signatures/broker-candidates.ts");
  const allBrokers = [
    { id: "broker-self", name: "Broker propio", email: "self@example.test", license_number: "C-1" },
    { id: "broker-assigned", name: "Broker asignado", email: "assigned@example.test", license_number: "C-2" },
  ];
  const memberWithAssigned = {
    unsafe: async (query) => String(query).includes("SELECT system_role")
      ? [{ system_role: "member", assigned_broker_user_id: "broker-assigned" }]
      : allBrokers,
  };
  assert.deepEqual(
    await listSignatureBrokerCandidates(memberWithAssigned, "member-1"),
    [{ id: "broker-assigned", name: "Broker asignado", email: "assigned@example.test", licenseNumber: "C-2" }],
  );
  assert.equal(await resolveSignatureBrokerCandidate(memberWithAssigned, "broker-self", "member-1"), null);
  const memberWithoutBroker = {
    unsafe: async (query) => String(query).includes("SELECT system_role")
      ? [{ system_role: "member", assigned_broker_user_id: null }]
      : allBrokers,
  };
  assert.deepEqual(await listSignatureBrokerCandidates(memberWithoutBroker, "member-2"), []);
});

test("new documents own the broker assignment while the legacy setting stays outside normal workflow", async () => {
  const [drafts, form, route, settings, directory] = await Promise.all([
    source("lib/signatures/draft-application.ts"),
    source("app/admin/signatures/nuevo/NewSignatureDraftForm.tsx"),
    source("app/api/admin/signatures/drafts/route.ts"),
    source("app/admin/signatures/configuracion/page.tsx"),
    source("app/admin/signatures/page.tsx"),
  ]);

  assert.match(drafts, /resolveSignatureBrokerCandidate/);
  assert.match(drafts, /brokerCandidateId/);
  assert.match(drafts, /isBrokerFinalSigner:true/);
  assert.match(form, /Firmará al final:/);
  assert.match(form, /brokerCandidates\.length === 1/);
  assert.match(form, /Corredor\(a\) firmante/);
  assert.match(form, /No hay un corredor autorizado disponible/);
  assert.match(await source("app/admin/signatures/nuevo/page.tsx"), /requireModuleAccess\("signatures", "manage"\)/);
  assert.match(route, /brokerCandidateId/);
  assert.match(route, /signature_broker_unavailable/);
  assert.match(settings, /redirect\("\/admin\/signatures"\)/);
  assert.doesNotMatch(directory, /href="\/admin\/signatures\/configuracion"/);
});

test("templates preserve roles rather than people and use the same broker assignment contract", async () => {
  const [templateUse, instantiate, productization] = await Promise.all([
    source("app/admin/signatures/plantillas/[id]/usar/page.tsx"),
    source("app/api/admin/signatures/templates/[id]/instantiate/route.ts"),
    source("lib/signatures/productization.ts"),
  ]);

  assert.match(templateUse, /listSignatureBrokerCandidates/);
  assert.match(templateUse, /session\.id/);
  assert.match(templateUse, /Firmará al final:/);
  assert.match(templateUse, /brokerCandidateId/);
  assert.match(instantiate, /brokerCandidateId/);
  assert.match(productization, /role_blueprint/);
  assert.doesNotMatch(templateUse, /corredora configurada se añadirá automáticamente/i);
});

test("broker-last and sent-document integrity remain protected by the existing server model", async () => {
  const [migration, preflight, sendReadiness] = await Promise.all([
    source("db/migrations/0035_productize_boriki_sign.sql"),
    source("lib/signatures/preflight.ts"),
    source("lib/signatures/send-readiness.ts"),
  ]);

  assert.match(migration, /signature_enforce_broker_final_routing/);
  assert.match(migration, /configured final broker must have a routing group after every transaction party/);
  assert.match(migration, /sent signature document identity is immutable/);
  assert.match(preflight, /broker_final_signer_invalid/);
  assert.match(sendReadiness, /broker_final_signer_ineligible/);
  assert.match(sendReadiness, /isPersistedBrokerParticipantEligible/);
});
