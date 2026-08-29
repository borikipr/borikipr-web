import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { signatureGovernanceBlockersForLocales } from "../lib/signatures/governance-readiness.ts";
import { parseSignatureParticipantDraft } from "../lib/signatures/admin-participant.ts";
import { SIGNATURE_DOCUMENT_TYPES } from "../lib/signatures/document-classification.ts";

const root = path.dirname(fileURLToPath(new URL("../package.json", import.meta.url)));
const read = (name) => readFile(path.join(root, name), "utf8");

test("Spanish-only canary readiness does not require English governance", () => {
  const spanish = signatureGovernanceBlockersForLocales({
    requiredLocales: ["es-PR"], activeApprovalCount: 1,
    approvedConsentLocales: new Set(["es-PR"]), approvedPrivacyLocales: new Set(["es-PR"]),
    retentionConfigured: true, evidenceKeysConfigured: true,
  });
  assert.deepEqual(spanish, []);
  const bilingual = signatureGovernanceBlockersForLocales({
    requiredLocales: ["es-PR", "en-US"], activeApprovalCount: 1,
    approvedConsentLocales: new Set(["es-PR"]), approvedPrivacyLocales: new Set(["es-PR"]),
    retentionConfigured: true, evidenceKeysConfigured: true,
  });
  assert.deepEqual(bilingual, ["approved_consent_en_us_missing", "approved_privacy_en_us_missing"]);
});

test("ordinary brokerage classifications use internal approval while formal categories remain cautioned", () => {
  for (const id of ["transaction_acknowledgment", "buyer_representation_agreement", "listing_related_agreement", "ordinary_brokerage_agreement", "ordinary_transaction_addendum"]) {
    const item = SIGNATURE_DOCUMENT_TYPES.find((entry) => entry.id === id);
    assert.equal(item?.scope, "ordinary_brokerage");
    assert.equal(item?.defaultApprovalMode, "internal_business");
  }
  for (const id of ["deed", "notarized_document", "judicial_filing", "property_registry_instrument"]) {
    const item = SIGNATURE_DOCUMENT_TYPES.find((entry) => entry.id === id);
    assert.equal(item?.scope, "formality_caution");
    assert.equal(item?.defaultApprovalMode, "out_of_scope");
  }
});

test("natural Spanish participant roles remain valid while flags stay unrelated", () => {
  for (const role of ["Comprador", "Vendedor", "Arrendador", "Arrendatario", "Agente comprador"]) {
    assert.equal(parseSignatureParticipantDraft({ name: "Persona Sintética", email: `${role.replaceAll(" ", "-").toLowerCase()}@example.test`, role, routingOrder: "" }).role, role);
  }
});

test("governance mobile styles contain direct support status at 360, 390 and 412 pixel layouts", async () => {
  const [styles, page, layout, nav] = await Promise.all([
    read("app/globals.css"), read("app/admin/signatures/gobernanza/page.tsx"),
    read("app/admin/layout.tsx"), read("components/admin/AdminNav.tsx"),
  ]);
  assert.match(styles, /\.signature-governance[\s\S]*overflow-x:\s*(?:clip|hidden)/);
  assert.match(styles, /\.signature-governance input:not[\s\S]*max-width:\s*100%/);
  assert.match(styles, /box-sizing:\s*border-box/);
  assert.match(page, /flex flex-col gap-3/);
  assert.match(page, /sm:grid-cols-2/);
  assert.match(layout, /min-w-0 max-w-\[1480px\]/);
  assert.match(nav, /flex min-w-0 flex-1 items-center justify-end/);
  assert.match(nav, /w-\[88vw\] max-w-\[380px\]/);
  assert.match(nav, /createPortal[\s\S]*document\.body/);
  assert.match(nav, /data-admin-drawer-backdrop/);
});

test("Governance keeps daily and recovery status compact without a management console", async () => {
  const [page, actions] = await Promise.all([
    read("app/admin/signatures/gobernanza/page.tsx"), read("app/admin/signatures/actions.ts"),
  ]);
  assert.match(page, /Estado y soporte/);
  assert.match(page, /Firmas operando normalmente/);
  assert.match(page, /Firmas requiere atención/);
  assert.match(page, /Español e inglés listos/);
  assert.match(page, /La recuperación se usa ante incidentes de infraestructura/);
  assert.doesNotMatch(page, /Administrar controles|gobernanza\/gestion/);
  assert.doesNotMatch(page, /Canary interno|Readiness interno|Auditoría y referencia/);
  assert.match(actions, /Falta configurar y activar la política de retención/);
  assert.doesNotMatch(page, />retention_policy_missing</);
  assert.doesNotMatch(page, />privacy_disclosure_missing</);
  assert.doesNotMatch(page, /Canary interno|Tokens\/digests|Sesiones|Eventos de auditoría/);
});
