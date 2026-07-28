import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

import {
  collectAvailabilityRegistrationsInTransaction,
  queueAvailabilityNotificationIntentsInTransaction,
} from "../lib/property-availability-enqueue.ts";

async function createFixture() {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE leads (id uuid PRIMARY KEY);
    CREATE TABLE propiedades (
      id uuid PRIMARY KEY,
      slug text NOT NULL,
      titulo text NOT NULL,
      estado text NOT NULL
    );
    CREATE TABLE property_priority_registrations (
      id uuid PRIMARY KEY,
      property_id uuid NOT NULL REFERENCES propiedades(id),
      lead_id uuid NULL REFERENCES leads(id),
      name text NOT NULL,
      email text NOT NULL,
      notified_at timestamptz NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE email_queue (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      recipient text NOT NULL,
      subject text NOT NULL,
      html text NOT NULL,
      email_type text NOT NULL,
      related_property_id uuid NULL,
      related_lead_id uuid NULL,
      canonical_lead_id uuid NULL,
      related_submission_type text NULL,
      related_submission_id uuid NULL,
      dedupe_key text NULL,
      status text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      last_error text NULL
    );
    CREATE UNIQUE INDEX email_queue_dedupe_key_uidx
      ON email_queue (dedupe_key) WHERE dedupe_key IS NOT NULL;
  `);
  const propertyId = randomUUID();
  const leadId = randomUUID();
  const registrationId = randomUUID();
  await db.query("INSERT INTO leads (id) VALUES ($1)", [leadId]);
  await db.query(
    "INSERT INTO propiedades (id, slug, titulo, estado) VALUES ($1, 'fixture', 'Casa fixture', 'coming_soon')",
    [propertyId]
  );
  await db.query(
    `INSERT INTO property_priority_registrations
       (id, property_id, lead_id, name, email)
     VALUES ($1, $2, $3, 'Fixture', 'fixture@example.invalid')`,
    [registrationId, propertyId, leadId]
  );
  return { db, propertyId, registrationId };
}

function transactionAdapter(transaction) {
  return {
    async unsafe(query, parameters = []) {
      return (await transaction.query(query, parameters)).rows;
    },
  };
}

async function persistTransitionAndIntent(transaction, propertyId) {
  const adapter = transactionAdapter(transaction);
  await transaction.query(
    "UPDATE propiedades SET estado='disponible' WHERE id=$1",
    [propertyId]
  );
  const registrations = await collectAvailabilityRegistrationsInTransaction(
    adapter,
    propertyId
  );
  return queueAvailabilityNotificationIntentsInTransaction(
    adapter,
    { id: propertyId, slug: "fixture", title: "Casa fixture" },
    registrations
  );
}

test("coming soon to available commits status and durable intents atomically", async () => {
  const { db, propertyId, registrationId } = await createFixture();
  try {
    const result = await db.transaction((transaction) =>
      persistTransitionAndIntent(transaction, propertyId)
    );
    assert.equal(result.inserted, 1);
    assert.equal(result.dedupeKeys.length, 1);

    const property = await db.query("SELECT estado FROM propiedades WHERE id=$1", [
      propertyId,
    ]);
    assert.equal(property.rows[0].estado, "disponible");

    const queue = await db.query(
      `SELECT status, attempts, related_lead_id::text, dedupe_key
       FROM email_queue`
    );
    assert.equal(queue.rows.length, 1);
    assert.equal(queue.rows[0].status, "pending");
    assert.equal(queue.rows[0].attempts, 0);
    assert.equal(queue.rows[0].related_lead_id, registrationId);
    assert.equal(
      queue.rows[0].dedupe_key,
      `property_availability:${propertyId}:${registrationId}:v1`
    );
  } finally {
    await db.close();
  }
});

test("a transaction failure rolls back both property state and notification intent", async () => {
  const { db, propertyId } = await createFixture();
  try {
    await assert.rejects(
      db.transaction(async (transaction) => {
        await persistTransitionAndIntent(transaction, propertyId);
        throw new Error("synthetic crash before commit");
      }),
      /synthetic crash/
    );
    const property = await db.query("SELECT estado FROM propiedades WHERE id=$1", [
      propertyId,
    ]);
    const queue = await db.query("SELECT count(*)::int AS count FROM email_queue");
    assert.equal(property.rows[0].estado, "coming_soon");
    assert.equal(queue.rows[0].count, 0);
  } finally {
    await db.close();
  }
});

test("the business-event dedupe key makes repeated intent creation idempotent", async () => {
  const { db, propertyId } = await createFixture();
  try {
    await db.transaction((transaction) =>
      persistTransitionAndIntent(transaction, propertyId)
    );
    const repeated = await db.transaction(async (transaction) => {
      const adapter = transactionAdapter(transaction);
      const registrations = await collectAvailabilityRegistrationsInTransaction(
        adapter,
        propertyId
      );
      return queueAvailabilityNotificationIntentsInTransaction(
        adapter,
        { id: propertyId, slug: "fixture", title: "Casa fixture" },
        registrations
      );
    });
    assert.equal(repeated.inserted, 0);
    assert.equal(repeated.alreadyRecorded, 1);
    const queue = await db.query("SELECT count(*)::int AS count FROM email_queue");
    assert.equal(queue.rows[0].count, 1);
  } finally {
    await db.close();
  }
});

test("recovery remains dry-run by default and never sends historical email", async () => {
  const script = await readFile(
    new URL("../scripts/email/recover-availability-notifications.ts", import.meta.url),
    "utf8"
  );
  const recovery = await readFile(
    new URL("../lib/property-availability-recovery.ts", import.meta.url),
    "utf8"
  );
  assert.match(script, /const apply = process\.argv\.includes\("--apply"\)/);
  assert.match(script, /QUEUE_AVAILABILITY_GAPS/);
  assert.match(script, /No email was sent by this command/);
  assert.doesNotMatch(script, /processPendingEmailQueue|emails\.send|new Resend/);
  assert.match(recovery, /notified_at IS NULL/);
  assert.match(recovery, /NOT EXISTS/);
  assert.match(recovery, /q\.dedupe_key/);
});

test("the protected queue cron recovers missing availability intents before delivery", async () => {
  const route = await readFile(
    new URL("../app/api/cron/process-email-queue/route.ts", import.meta.url),
    "utf8"
  );
  const recoveryIndex = route.indexOf(
    "queueMissingAvailabilityNotificationIntents()"
  );
  const deliveryIndex = route.indexOf("processPendingEmailQueue()");
  assert.ok(recoveryIndex > 0);
  assert.ok(deliveryIndex > recoveryIndex);
  assert.match(route, /availabilityRecovery/);
});
