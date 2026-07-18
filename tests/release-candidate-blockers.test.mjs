import assert from "node:assert/strict";
import { File as NodeFile } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import {
  BuyerProfileValidationError,
  parsePropertyBuyerProfileFormData,
} from "../lib/leads/property-buyer-profile.ts";
import {
  BUYER_PROFILE_FILE_TOO_LARGE_MESSAGE,
  MAX_BUYER_PROFILE_DOCUMENT_BYTES,
} from "../lib/leads/property-buyer-profile-upload.ts";
import {
  enqueueAvailabilityNotificationsInTransaction,
} from "../lib/property-availability-enqueue.ts";
import {
  buildPropertyAvailabilityDedupeKey,
  PROPERTY_AVAILABILITY_EMAIL_TYPE,
} from "../lib/property-availability-notifications.ts";
import { deliverClaimedEmail } from "../lib/email-queue-delivery.ts";

if (!globalThis.File) globalThis.File = NodeFile;

const root = fileURLToPath(new URL("..", import.meta.url));
const [formSource, routeSource, actionSource, queueSource, vercelConfig] =
  await Promise.all([
    readFile(`${root}/components/FormularioPerfilComprador.tsx`, "utf8"),
    readFile(`${root}/app/api/formulario/perfil-comprador/route.ts`, "utf8"),
    readFile(`${root}/app/admin/propiedades/actions.ts`, "utf8"),
    readFile(`${root}/lib/email-queue.ts`, "utf8"),
    readFile(`${root}/vercel.json`, "utf8"),
  ]);

function buyerProfileForm(file, method = "Financiamiento") {
  const form = new FormData();
  form.set("idempotencyKey", randomUUID());
  form.set("propertyId", randomUUID());
  form.set("propertySlug", "fixture-property");
  form.set("propertyTitle", "Fixture Property");
  form.set("nombre", "Controlled Fixture");
  form.set("telefono", "787-555-0101");
  form.set("email", "fixture@example.invalid");
  form.set("metodoCompra", method);
  if (file) form.set("cartaPreaprobacion", file);
  return form;
}

test("Buyer Profile accepts files below and exactly at the 4 MB boundary", () => {
  for (const size of [MAX_BUYER_PROFILE_DOCUMENT_BYTES - 1, MAX_BUYER_PROFILE_DOCUMENT_BYTES]) {
    const parsed = parsePropertyBuyerProfileFormData(
      buyerProfileForm(
        new NodeFile([new Uint8Array(size)], "document.pdf", {
          type: "application/pdf",
        })
      )
    );
    assert.equal(parsed.file.size, size);
    assert.equal(parsed.documentType, "prequalification_letter");
  }
});

test("Buyer Profile rejects files above 4 MB before persistence", () => {
  let persistenceCalls = 0;
  assert.throws(
    () => {
      const parsed = parsePropertyBuyerProfileFormData(
        buyerProfileForm(
          new NodeFile(
            [new Uint8Array(MAX_BUYER_PROFILE_DOCUMENT_BYTES + 1)],
            "document.pdf",
            { type: "application/pdf" }
          )
        )
      );
      persistenceCalls += 1;
      return parsed;
    },
    (error) =>
      error instanceof BuyerProfileValidationError &&
      error.reason === "document_too_large" &&
      error.publicMessage === BUYER_PROFILE_FILE_TOO_LARGE_MESSAGE
  );
  assert.equal(persistenceCalls, 0);
});

test("Buyer Profile keeps MIME validation, optional uploads, and both document paths", () => {
  assert.throws(
    () =>
      parsePropertyBuyerProfileFormData(
        buyerProfileForm(
          new NodeFile(["content"], "document.txt", { type: "text/plain" })
        )
      ),
    (error) =>
      error instanceof BuyerProfileValidationError &&
      error.reason === "invalid_document_type"
  );
  assert.equal(parsePropertyBuyerProfileFormData(buyerProfileForm(null)).file, null);
  const cash = parsePropertyBuyerProfileFormData(
    buyerProfileForm(
      new NodeFile(["content"], "funds.pdf", { type: "application/pdf" }),
      "Cash"
    )
  );
  assert.equal(cash.documentType, "proof_of_funds");
});

test("all Buyer Profile upload guidance and validation share the 4 MB limit", () => {
  assert.match(formSource, /BUYER_PROFILE_UPLOAD_HELPER/);
  assert.match(formSource, /MAX_BUYER_PROFILE_DOCUMENT_BYTES/);
  assert.match(routeSource, /MAX_BUYER_PROFILE_DOCUMENT_BYTES/);
  assert.doesNotMatch(`${formSource}\n${routeSource}`, /10\s*MB|10MB/);
});

class FakeAvailabilityTransaction {
  constructor(registrations) {
    this.registrations = registrations;
    this.queueByDedupe = new Map();
  }

  async unsafe(query, params) {
    if (query.includes("FROM public.property_priority_registrations")) {
      assert.match(query, /notified_at IS NULL/);
      assert.match(query, /FOR UPDATE/);
      return this.registrations;
    }
    if (query.includes("INSERT INTO public.email_queue")) {
      assert.match(query, /ON CONFLICT \(dedupe_key\)/);
      const dedupeKey = params[9];
      if (this.queueByDedupe.has(dedupeKey)) return [];
      const row = {
        id: randomUUID(),
        recipient: params[0],
        subject: params[1],
        html: params[2],
        emailType: params[3],
        relatedPropertyId: params[4],
        relatedRegistrationId: params[5],
        canonicalLeadId: params[6],
        submissionType: params[7],
        submissionId: params[8],
        dedupeKey,
        status: "pending",
        attempts: 0,
      };
      this.queueByDedupe.set(dedupeKey, row);
      return [{ id: row.id }];
    }
    throw new Error("Unexpected synthetic query");
  }
}

test("availability transition creates one durable deduplicated intent per eligible registration", async () => {
  const property = { id: randomUUID(), slug: "fixture", title: "Fixture <Home>" };
  const registrations = Array.from({ length: 84 }, (_, index) => ({
    id: randomUUID(),
    lead_id: randomUUID(),
    name: `Fixture ${index} <unsafe>`,
    email: `fixture-${index}@example.invalid`,
  }));
  registrations.push({
    id: randomUUID(),
    lead_id: null,
    name: "Invalid Fixture",
    email: "invalid-email",
  });
  const transaction = new FakeAvailabilityTransaction(registrations);

  const first = await enqueueAvailabilityNotificationsInTransaction(
    transaction,
    property
  );
  const repeated = await enqueueAvailabilityNotificationsInTransaction(
    transaction,
    property
  );

  assert.deepEqual(first, {
    eligibleRegistrations: 84,
    queued: 84,
    alreadyQueued: 0,
    skippedInvalidEmail: 1,
  });
  assert.deepEqual(repeated, {
    eligibleRegistrations: 84,
    queued: 0,
    alreadyQueued: 84,
    skippedInvalidEmail: 1,
  });
  assert.equal(transaction.queueByDedupe.size, 84);
  const [row] = transaction.queueByDedupe.values();
  assert.equal(row.emailType, PROPERTY_AVAILABILITY_EMAIL_TYPE);
  assert.equal(
    row.dedupeKey,
    buildPropertyAvailabilityDedupeKey(property.id, row.relatedRegistrationId)
  );
  assert.match(row.html, /Fixture &lt;Home&gt;/);
  assert.doesNotMatch(row.html, /Fixture 0 <unsafe>/);
});

test("property transition is transactional and never calls Resend directly", () => {
  assert.doesNotMatch(actionSource, /from "resend"|new Resend|emails\.send/);
  assert.match(actionSource, /sql\.begin\(async \(transaction\)/);
  assert.match(actionSource, /FOR UPDATE/);
  assert.match(actionSource, /enqueueAvailabilityNotificationsInTransaction/);
  assert.doesNotMatch(actionSource, /AVAILABILITY EMAIL SENT TO|email:\s*registration\.email/);
});

test("queue worker preserves locking, retry, idempotent delivery, and notification finalization", () => {
  assert.match(queueSource, /FOR UPDATE SKIP LOCKED/);
  assert.match(queueSource, /STALE_PROCESSING_TIMEOUT = "15 minutes"/);
  assert.match(queueSource, /MAX_EMAIL_ATTEMPTS = 5/);
  assert.match(queueSource, /idempotencyKey: row\.dedupe_key/);
  assert.match(queueSource, /PROPERTY_AVAILABILITY_EMAIL_TYPE/);
  assert.match(queueSource, /SET notified_at = now\(\)/);
  assert.match(queueSource, /AND notified_at IS NULL/);
  assert.match(queueSource, /status = \$\{terminal \? "failed" : "pending"\}/);
});

test("partial delivery failures remain retryable and later success finalizes once", async () => {
  let attempts = 0;
  let successfulSends = 0;
  let notifiedAt = null;
  let queueStatus = "processing";

  const first = await deliverClaimedEmail({
    attempts,
    maximumAttempts: 5,
    send: async () => {
      throw new Error("synthetic provider failure");
    },
    markFailure: async ({ attempts: nextAttempts, terminal }) => {
      attempts = nextAttempts;
      queueStatus = terminal ? "failed" : "pending";
    },
    markSuccess: async () => assert.fail("failure must not finalize"),
  });
  assert.deepEqual(first, { status: "retryable", attempts: 1 });
  assert.equal(queueStatus, "pending");
  assert.equal(notifiedAt, null);

  queueStatus = "processing";
  const retry = await deliverClaimedEmail({
    attempts,
    maximumAttempts: 5,
    send: async () => {
      successfulSends += 1;
    },
    markFailure: async () => assert.fail("success must not mark failure"),
    markSuccess: async () => {
      queueStatus = "sent";
      notifiedAt = new Date();
    },
  });
  assert.deepEqual(retry, { status: "sent" });
  assert.equal(queueStatus, "sent");
  assert.equal(successfulSends, 1);
  assert.ok(notifiedAt instanceof Date);

  // Sent rows are not eligible for a subsequent claim, so the worker does not
  // invoke delivery again after the durable success state is recorded.
  assert.notEqual(queueStatus, "pending");
  assert.equal(successfulSends, 1);
});

test("terminal delivery failure follows the existing five-attempt policy", async () => {
  let markedTerminal = false;
  const outcome = await deliverClaimedEmail({
    attempts: 4,
    maximumAttempts: 5,
    send: async () => {
      throw new Error("synthetic terminal failure");
    },
    markFailure: async ({ terminal }) => {
      markedTerminal = terminal;
    },
    markSuccess: async () => assert.fail("failure must not finalize"),
  });
  assert.deepEqual(outcome, { status: "failed", attempts: 5 });
  assert.equal(markedTerminal, true);
});

test("queue catalog behavior prevents duplicates and claims a row only once", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE email_queue (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        dedupe_key text NULL,
        status text NOT NULL DEFAULT 'pending',
        attempts integer NOT NULL DEFAULT 0,
        locked_at timestamptz NULL,
        locked_by text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE UNIQUE INDEX email_queue_dedupe_key_uidx
        ON email_queue (dedupe_key) WHERE dedupe_key IS NOT NULL;
    `);
    const key = `property_availability:${randomUUID()}:${randomUUID()}:v1`;
    await db.query(
      `INSERT INTO email_queue (dedupe_key) VALUES ($1)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      [key]
    );
    await db.query(
      `INSERT INTO email_queue (dedupe_key) VALUES ($1)
       ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
      [key]
    );
    const count = await db.query("SELECT count(*)::int AS count FROM email_queue");
    assert.equal(count.rows[0].count, 1);

    const claim = async (worker) =>
      db.query(
        `WITH candidate AS (
           SELECT id FROM email_queue WHERE status='pending'
           LIMIT 1 FOR UPDATE SKIP LOCKED
         )
         UPDATE email_queue SET status='processing', locked_by=$1, locked_at=now()
         FROM candidate WHERE email_queue.id=candidate.id
         RETURNING email_queue.id::text`,
        [worker]
      );
    assert.equal((await claim("worker-one")).rows.length, 1);
    assert.equal((await claim("worker-two")).rows.length, 0);
  } finally {
    await db.close();
  }
});

test("current free-compatible queue run can process all 84 recipients in one daily batch", () => {
  assert.match(queueSource, /DEFAULT_EMAIL_QUEUE_BATCH_SIZE = 100/);
  assert.match(queueSource, /EMAIL_QUEUE_SEND_INTERVAL_MS = 250/);
  const config = JSON.parse(vercelConfig);
  assert.deepEqual(config.crons, [
    { path: "/api/cron/process-email-queue", schedule: "0 9 * * *" },
  ]);
});
