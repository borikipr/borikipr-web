import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

async function source(path) {
  return readFile(fileURLToPath(new URL(`../${path}`, import.meta.url)), "utf8");
}

const durableRoutes = [
  {
    path: "app/api/formulario/comprador/route.ts",
    handler: "handlePersistedBuyerTenantInquiry",
  },
  {
    path: "app/api/formulario/vendedor/route.ts",
    handler: "handlePersistedSellerLandlordInquiry",
  },
  {
    path: "app/api/formulario/perfil-comprador/route.ts",
    handler: "handlePersistedPropertyBuyerProfile",
  },
  {
    path: "app/api/consultas-propiedad/route.ts",
    handler: "handleOpenHouseRegistrationV2",
  },
];

for (const { path, handler } of durableRoutes) {
  test(`${path} always delegates to its durable persistence handler`, async () => {
    const route = await source(path);
    assert.match(route, new RegExp(`return ${handler}\\(request\\)`));
    assert.doesNotMatch(route, /PERSISTENCE_V\d|new Resend|emails\.send|process\.env\.[A-Z_]*PERSISTENCE/);
  });
}

test("Priority Registration always persists through canonical lead resolution", async () => {
  const route = await source("app/api/registro-prioritario/route.ts");
  assert.match(route, /persistPriorityRegistrationWithCanonicalLead\(\{/);
  assert.doesNotMatch(
    route,
    /PRIORITY_REGISTRATION_CANONICAL_LEAD_V1|isPriorityRegistrationCanonicalLeadEnabled|isUndefinedColumn/
  );
  assert.doesNotMatch(route, /INSERT INTO property_priority_registrations/);
});

test("Private Showing remains a durable persisted workflow", async () => {
  const route = await source("app/api/private-showing-registration/route.ts");
  const handler = await source("lib/leads/open-house-registration-handler.ts");
  assert.match(route, /handlePrivateShowingRegistration\(request\)/);
  assert.match(handler, /persistPrivateShowingRegistration/);
  assert.doesNotMatch(route, /new Resend|emails\.send/);
});

test("the unused legacy contact API is removed", async () => {
  const path = fileURLToPath(new URL("../app/api/contact/route.ts", import.meta.url));
  await assert.rejects(access(path));
});
