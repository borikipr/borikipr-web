import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  buildPrivateShowingDocumentObjectKey,
  OpenHouseValidationError,
  parsePrivateShowingRegistrationFormData,
  validatePrivateShowingForProperty,
} from "../lib/leads/open-house-registration.ts";
import { generatePrivateShowingToken } from "../lib/leads/private-showing-token.ts";
import { buildOpenHouseInternalEmail } from "../lib/leads/open-house-registration-email.ts";
import { buildOpenHouseCustomerEmail } from "../lib/leads/open-house-registration-customer-email.ts";
import {
  isPrivateTokenizedPath,
  shouldExcludeAnalyticsPath,
} from "../lib/analytics-routes.ts";

const propertyId = randomUUID();
const token = generatePrivateShowingToken();

function privateForm(overrides = {}) {
  const values = {
    idempotencyKey: randomUUID(),
    propertyId,
    propertySlug: "casa-privada",
    privateToken: token,
    nombre: "Persona Sintética",
    telefono: "787-555-0101",
    email: "private@example.invalid",
    metodo_compra: "Otro",
    metodoCompraOtro: "Programa especial",
    fondos_gastos_cierre: "Parcialmente",
    trabajando_con_corredor: "No",
    ...overrides,
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) data.set(key, String(value));
  }
  return data;
}

function property(overrides = {}) {
  return {
    id: propertyId,
    slug: "casa-privada",
    title: "Casa privada",
    status: "disponible",
    origin: "propio",
    mayPublishOnWeb: true,
    showingFormActive: false,
    showingAt: null,
    requiresPrequalification: false,
    hasSolarLease: false,
    privateShowingToken: token,
    ...overrides,
  };
}

function persisted(overrides = {}) {
  return {
    workflow: "private_showing",
    id: randomUUID(),
    leadId: randomUUID(),
    created: true,
    property: { id: propertyId, slug: "casa-privada", title: "Casa privada" },
    showingAt: null,
    showingEventKey: null,
    name: "Persona Sintética",
    phone: "787-555-0101",
    email: "private@example.invalid",
    purchaseMethod: "Otro",
    purchaseMethodOther: "Programa especial",
    attendanceAvailability: null,
    closingFunds: "Parcialmente",
    workingWithBroker: "No",
    brokerName: null,
    brokerPhone: null,
    customQuestion: null,
    customAnswer: null,
    solarContractAcceptance: null,
    prequalificationKey: null,
    prequalificationStatus: "none",
    proofOfFundsKey: null,
    proofOfFundsStatus: "none",
    documentOriginalName: null,
    documentContentType: null,
    documentSizeBytes: null,
    reusedPropertyBuyerProfileId: null,
    ...overrides,
  };
}

test("private tokens use 256-bit cryptographic randomness and are unique", () => {
  const tokens = new Set(Array.from({ length: 100 }, generatePrivateShowingToken));
  assert.equal(tokens.size, 100);
  for (const value of tokens) {
    assert.equal(value.length, 43);
    assert.match(value, /^[A-Za-z0-9_-]+$/);
  }
});

test("private parser has no attendance, solar, date, or Open House workflow state", () => {
  const parsed = parsePrivateShowingRegistrationFormData(privateForm());
  assert.equal(parsed.workflow, "private_showing");
  assert.equal(parsed.privateToken, token);
  assert.equal(parsed.submittedShowingAt, null);
  assert.equal(parsed.attendanceAvailability, null);
  assert.equal(parsed.solarContractAcceptance, null);
  assert.doesNotThrow(() => validatePrivateShowingForProperty(parsed, property()));
});

test("private validation rejects wrong identity, token, closed status, and injected attendance", () => {
  const valid = parsePrivateShowingRegistrationFormData(privateForm());
  for (const [candidate, reason] of [
    [{ ...property(), slug: "otra-casa" }, "property_identity_mismatch"],
    [{ ...property(), privateShowingToken: generatePrivateShowingToken() }, "invalid_private_token"],
    [{ ...property(), status: "vendida" }, "property_not_available"],
  ]) {
    assert.throws(
      () => validatePrivateShowingForProperty(valid, candidate),
      (error) => error instanceof OpenHouseValidationError && error.reason === reason
    );
  }
  assert.throws(
    () =>
      validatePrivateShowingForProperty(
        { ...valid, attendanceAvailability: "Sí" },
        property()
      ),
    /Una respuesta enviada no aplica/
  );
});

test("private financial requirements match the existing secure reuse rules", () => {
  const financing = parsePrivateShowingRegistrationFormData(
    privateForm({ metodo_compra: "Financiamiento", metodoCompraOtro: null })
  );
  assert.throws(
    () => validatePrivateShowingForProperty(financing, property()),
    (error) =>
      error instanceof OpenHouseValidationError &&
      error.reason === "missing_required_prequalification"
  );
  assert.doesNotThrow(() =>
    validatePrivateShowingForProperty(financing, property(), true)
  );
  const cash = parsePrivateShowingRegistrationFormData(
    privateForm({ metodo_compra: "Cash", metodoCompraOtro: null })
  );
  assert.throws(
    () => validatePrivateShowingForProperty(cash, property()),
    (error) =>
      error instanceof OpenHouseValidationError &&
      error.reason === "missing_required_proof_of_funds"
  );
});

test("private document keys are isolated and contain no customer data", () => {
  const registrationId = randomUUID();
  assert.equal(
    buildPrivateShowingDocumentObjectKey(
      registrationId,
      "proof_of_funds",
      "pdf"
    ),
    `lead-documents/private-showing-registrations/${registrationId}/proof_of_funds.pdf`
  );
});

test("private email wording excludes Open House attendance, date, and solar", () => {
  const internal = buildOpenHouseInternalEmail({
    registration: persisted(),
    documentStatus: "none",
  });
  const customer = buildOpenHouseCustomerEmail(persisted());
  assert.match(internal.subject, /Nuevo registro de visita privada/);
  assert.doesNotMatch(internal.html, /Open House|Disponibilidad:|contrato solar|<strong>Fecha:/);
  assert.match(customer.html, /registro de visita privada/);
  assert.doesNotMatch(customer.html, /Open House|<strong>Fecha:/);
});

test("tokenized route is excluded from third-party analytics", () => {
  const path = `/listados/casa-privada/visita/${token}`;
  assert.equal(isPrivateTokenizedPath(path), true);
  assert.equal(shouldExcludeAnalyticsPath(path), true);
  assert.equal(shouldExcludeAnalyticsPath("/listados/casa-privada"), false);
});

test("private route and admin controls stay isolated from public surfaces", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const [page, component, sitemap, propertyActions, api, migration] =
    await Promise.all([
      readFile(`${root}app/(public)/listados/[slug]/visita/[privateToken]/page.tsx`, "utf8"),
      readFile(`${root}components/PerfilCompradorPropiedadForm.tsx`, "utf8"),
      readFile(`${root}app/sitemap.ts`, "utf8"),
      readFile(`${root}app/admin/propiedades/PropiedadRowActions.tsx`, "utf8"),
      readFile(`${root}app/api/admin/propiedades/[id]/private-showing-link/route.ts`, "utf8"),
      readFile(`${root}db/migrations/0016_add_private_showing_registration.sql`, "utf8"),
    ]);
  assert.match(page, /index: false/);
  assert.match(page, /Registro de visita a la propiedad/);
  assert.match(component, /workflow === "open_house" &&/);
  assert.match(component, /label="Email"/);
  assert.match(component, /private_showing_form_submit_success/);
  assert.doesNotMatch(sitemap, /privateToken|\/visita\//);
  assert.match(propertyActions, /Enlace privado de visita/);
  assert.match(propertyActions, /Regenerar enlace privado/);
  assert.match(api, /getAdminSession/);
  assert.match(api, /isSameOrigin/);
  assert.match(migration, /workflow_source/);
  assert.doesNotMatch(migration, /showing_enabled|private_showing_enabled/);
});
