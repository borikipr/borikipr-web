import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateOperationalHealth,
  shouldEmitHealthAlert,
} from "../lib/operational-monitoring-policy.ts";

const now = new Date("2026-07-28T12:00:00.000Z");
const recent = new Date("2026-07-28T09:00:00.000Z");
const stale = new Date("2026-07-26T00:00:00.000Z");

test("healthy state is quiet", () => {
  const result = evaluateOperationalHealth(
    {
      staleProcessing: 0,
      failedQueue: 0,
      missingAvailabilityIntents: 0,
      emailQueueLastSuccess: recent,
      adminCleanupLastSuccess: recent,
    },
    now
  );
  assert.equal(result.healthy, true);
  assert.deepEqual(result.conditions, []);
  assert.equal(
    shouldEmitHealthAlert({
      healthy: true,
      fingerprintChanged: true,
      lastAlertedAt: null,
      now,
    }),
    false
  );
});

test("queue, recovery, and cron failures are detected without identifiers", () => {
  const result = evaluateOperationalHealth(
    {
      staleProcessing: 2,
      failedQueue: 5,
      missingAvailabilityIntents: 1,
      emailQueueLastSuccess: stale,
      adminCleanupLastSuccess: null,
    },
    now
  );
  assert.equal(result.healthy, false);
  assert.deepEqual(result.conditions, [
    "admin_cleanup_cron_missing",
    "availability_intents_missing",
    "email_queue_cron_missing",
    "email_queue_failed_threshold",
    "email_queue_stale",
  ]);
  assert.match(result.fingerprint, /^[0-9a-f]{64}$/);
  assert.doesNotMatch(JSON.stringify(result), /@|phone|document|r2/i);
});

test("alerts deduplicate through fingerprint and cooldown", () => {
  assert.equal(
    shouldEmitHealthAlert({
      healthy: false,
      fingerprintChanged: true,
      lastAlertedAt: recent,
      now,
    }),
    true
  );
  assert.equal(
    shouldEmitHealthAlert({
      healthy: false,
      fingerprintChanged: false,
      lastAlertedAt: recent,
      now,
    }),
    false
  );
  assert.equal(
    shouldEmitHealthAlert({
      healthy: false,
      fingerprintChanged: false,
      lastAlertedAt: stale,
      now,
    }),
    true
  );
});
