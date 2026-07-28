import { expect, test } from "@playwright/test";

test("unauthorized secure document access is rejected", async ({ request }) => {
  const path =
    process.env.E2E_UNAUTHORIZED_DOCUMENT_PATH ||
    "/admin/leads/00000000-0000-0000-0000-000000000000/documents/property-buyer-profile/00000000-0000-0000-0000-000000000000";
  const response = await request.get(path, { maxRedirects: 0 });
  expect([302, 303, 307, 308, 401, 404]).toContain(response.status());
  expect(response.headers()["cache-control"] || "").not.toMatch(/public/i);
});

