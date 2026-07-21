import assert from "node:assert/strict";
import test from "node:test";
import { attemptImmediateDelivery, classifyEmailFailure } from "../lib/email-delivery.ts";
import { deliverClaimedEmail } from "../lib/email-queue-delivery.ts";
import { resolveOpenHouseInternalAttachment } from "../lib/leads/open-house-registration-queue-attachment.ts";

function harness(send) {
  const state = { recorded: 0, queued: [], permanent: [], queueFailures: [] };
  return {
    state,
    run: () => attemptImmediateDelivery({
      send,
      recordSuccess: async () => { state.recorded += 1; },
      enqueueRetry: async (error) => { state.queued.push(error); return "queued"; },
      serializeError: (error) => String(error?.message || error),
      onPermanentFailure: (error) => state.permanent.push(error),
      onQueueFailure: (error) => state.queueFailures.push(error),
      onRecordFailure: (error) => state.queueFailures.push(error),
    }),
  };
}

test("immediate provider acceptance records sent and creates no pending intent", async () => {
  const delivery = harness(async () => ({ id: "provider-id" }));
  assert.equal(await delivery.run(), "sent");
  assert.equal(delivery.state.recorded, 1);
  assert.equal(delivery.state.queued.length, 0);
});

for (const statusCode of [429, 500]) {
  test(`HTTP ${statusCode} creates exactly one retry intent`, async () => {
    const delivery = harness(async () => { throw { statusCode, message: "synthetic provider response" }; });
    assert.equal(await delivery.run(), "queued");
    assert.equal(delivery.state.recorded, 0);
    assert.equal(delivery.state.queued.length, 1);
  });
}

test("permanent payload/configuration failures never enter the retry loop", async () => {
  for (const error of [
    { statusCode: 400, message: "invalid recipient" },
    { statusCode: 401, message: "authentication failed" },
    new Error("RESEND_API_KEY is not configured."),
    new Error("Private document size does not match persisted metadata."),
  ]) {
    const delivery = harness(async () => { throw error; });
    assert.equal(await delivery.run(), "permanent_failure");
    assert.equal(delivery.state.queued.length, 0);
    assert.equal(delivery.state.permanent.length, 1);
  }
});

test("queue worker terminates a permanent failure after its one actual attempt", async () => {
  let failure;
  const outcome = await deliverClaimedEmail({
    attempts: 0,
    maximumAttempts: 5,
    send: async () => { throw { statusCode: 422, message: "invalid attachment" }; },
    markSuccess: async () => assert.fail("must not finalize"),
    markFailure: async (value) => { failure = value; },
    classifyFailure: classifyEmailFailure,
  });
  assert.deepEqual(outcome, { status: "failed", attempts: 1 });
  assert.equal(failure.terminal, true);
  assert.equal(failure.attempts, 1);
});

test("Open House immediate and queued attachment reconstruction preserves bytes, name, and MIME", async () => {
  const source = new Uint8Array([0, 7, 31, 127, 128, 255]);
  const resolve = () => resolveOpenHouseInternalAttachment({
    emailType: "open_house_registration_internal",
    relatedSubmissionType: "open_house_registration",
    relatedSubmissionId: "fixture-id",
    loadMetadata: async () => ({
      objectKey: "lead-documents/open-house-registrations/fixture/proof_of_funds.pdf",
      originalName: "Evidencia José.pdf",
      contentType: "application/pdf",
      sizeBytes: source.byteLength,
      status: "uploaded",
    }),
    download: async () => ({ bytes: source, contentType: "application/pdf" }),
  });
  for (const attachments of [await resolve(), await resolve()]) {
    assert.equal(attachments[0].filename, "Evidencia José.pdf");
    assert.equal(attachments[0].contentType, "application/pdf");
    assert.deepEqual(Buffer.from(attachments[0].content, "base64"), Buffer.from(source));
  }
});

test("Open House customer confirmation never receives the sensitive attachment", async () => {
  let metadataCalls = 0;
  const attachments = await resolveOpenHouseInternalAttachment({
    emailType: "open_house_registration_customer",
    relatedSubmissionType: "open_house_registration",
    relatedSubmissionId: "fixture-id",
    loadMetadata: async () => { metadataCalls += 1; return null; },
    download: async () => assert.fail("must not download"),
  });
  assert.equal(attachments, undefined);
  assert.equal(metadataCalls, 0);
});
