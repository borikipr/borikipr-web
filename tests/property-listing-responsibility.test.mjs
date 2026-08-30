import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile("db/migrations/0050_add_property_listing_responsibility.sql", "utf8");
const rollback = await readFile("db/migrations/0050_add_property_listing_responsibility.rollback.sql", "utf8");
const service = await readFile("lib/admin/listing-responsibility.ts", "utf8");

test("0050 locks responsibility to canonical accounts and protects append-only events", () => {
  assert.match(migration, /listing_responsible_user_id uuid NULL/);
  assert.match(migration, /REFERENCES public\.admin_users\(id\)\s+ON DELETE RESTRICT/);
  assert.match(migration, /ON DELETE CASCADE/);
  assert.match(migration, /BEFORE UPDATE OR DELETE/);
  assert.match(migration, /NOT EXISTS \(\s*SELECT 1 FROM public\.propiedades WHERE id = OLD\.property_id/);
  assert.match(migration, /previous_responsible_user_id <> next_responsible_user_id/);
});

test("0050 rollback fails closed and serializes its guard", () => {
  assert.match(rollback, /ACCESS EXCLUSIVE/);
  assert.match(rollback, /listing_responsible_user_id IS NOT NULL/);
  assert.match(rollback, /property_listing_responsibility_events/);
});

test("eligibility is account-lifecycle and licensed-professional based, never access based", () => {
  assert.match(service, /admin\.activo = true/);
  assert.match(service, /admin\.account_state = 'active'/);
  assert.match(service, /real_estate_broker/);
  assert.match(service, /real_estate_salesperson/);
  assert.match(service, /professional_license_number/);
  assert.doesNotMatch(service, /broker_authorized/);
  assert.doesNotMatch(service, /module_access/);
});
