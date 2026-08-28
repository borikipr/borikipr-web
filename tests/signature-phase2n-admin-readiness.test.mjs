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

test("governance mobile styles contain controls at 360, 390 and 412 pixel layouts", async () => {
  const [styles, forms, layout, nav] = await Promise.all([
    read("app/globals.css"), read("app/admin/signatures/gobernanza/GovernanceForms.tsx"),
    read("app/admin/layout.tsx"), read("components/admin/AdminNav.tsx"),
  ]);
  assert.match(styles, /\.signature-governance[\s\S]*overflow-x:\s*(?:clip|hidden)/);
  assert.match(styles, /\.signature-governance input:not[\s\S]*max-width:\s*100%/);
  assert.match(styles, /box-sizing:\s*border-box/);
  assert.match(forms, /signature-governance min-w-0 max-w-full/);
  assert.match(forms, /grid-cols-1/);
  assert.match(forms, /1\. Crear borrador/);
  assert.match(forms, /2\. Enviar a revisión/);
  assert.match(forms, /3\. Registrar decisión/);
  assert.match(layout, /min-w-0 max-w-\[1480px\]/);
  assert.match(nav, /flex min-w-0 flex-1 items-center justify-end/);
  assert.match(nav, /w-\[88vw\] max-w-\[380px\]/);
  assert.match(nav, /createPortal[\s\S]*document\.body/);
  assert.match(nav, /data-admin-drawer-backdrop/);
});

test("Admin UX translates readiness and explains retention without legal recommendations", async () => {
  const [page, actions, forms] = await Promise.all([
    read("app/admin/signatures/gobernanza/page.tsx"), read("app/admin/signatures/actions.ts"),
    read("app/admin/signatures/gobernanza/GovernanceForms.tsx"),
  ]);
  assert.match(page, /Readiness interno/);
  assert.match(page, /Alcance bilingüe/);
  assert.match(page, /READINESS_LABELS[\s\S]*Listo[\s\S]*Bloqueado/);
  assert.match(actions, /Falta configurar y activar la política de retención/);
  assert.doesNotMatch(page, />retention_policy_missing</);
  assert.doesNotMatch(page, />privacy_disclosure_missing</);
  for (const label of ["Documento fuente", "PDF final", "Certificado", "Manifest\/evidencia", "Tokens\/digests", "Sesiones", "Eventos de auditoría", "Borradores abandonados", "Network digests"]) assert.match(forms, new RegExp(label));
  assert.match(forms, /Canary interno: Desactivado/);
});
