import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  formatSchedulerLog,
  invokeBorikiTranslationWorker,
} from "../src/index.ts";

const EXPECTED_URL =
  "https://borikipr.com/api/cron/process-translation-jobs";

test("configuration schedules one UTC invocation every five minutes", async () => {
  const config = JSON.parse(
    await readFile(new URL("../wrangler.jsonc", import.meta.url), "utf8")
  );
  assert.equal(config.name, "borikipr-translation-scheduler");
  assert.equal(config.workers_dev, false);
  assert.deepEqual(config.compatibility_flags, [
    "global_fetch_strictly_public",
  ]);
  assert.deepEqual(config.triggers.crons, ["*/5 * * * *"]);
  assert.equal(JSON.stringify(config).includes("TRANSLATION_CRON_SECRET"), false);
});

function response(status = 200) {
  return new Response(JSON.stringify({ ignored: "response body" }), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("scheduled execution makes exactly one authenticated request to the fixed target", async () => {
  const calls = [];
  const logs = [];
  const result = await invokeBorikiTranslationWorker({
    secret: "synthetic-scheduler-secret",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return response(200);
    },
    logger: (event, details) => logs.push({ event, details }),
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, EXPECTED_URL);
  assert.equal(calls[0].init.method, "POST");
  assert.equal(
    calls[0].init.headers.authorization,
    "Bearer synthetic-scheduler-secret"
  );
  assert.equal(calls[0].init.redirect, "error");
  assert.deepEqual(result, { ok: true, outcome: "delivered", status: 200 });
  assert.doesNotMatch(JSON.stringify(logs), /synthetic-scheduler-secret|response body/);
});

test("missing secret fails closed without making a request", async () => {
  let calls = 0;
  const result = await invokeBorikiTranslationWorker({
    secret: " ",
    fetchImpl: async () => {
      calls += 1;
      return response();
    },
  });
  assert.equal(calls, 0);
  assert.deepEqual(result, {
    ok: false,
    outcome: "configuration_error",
    status: null,
  });
});

test("operational log formatting is aggregate-only and secret-free", () => {
  const line = formatSchedulerLog("translation_scheduler_completed", {
    ok: true,
    outcome: "delivered",
    status: 200,
    durationMs: 42,
  });
  assert.deepEqual(JSON.parse(line), {
    event: "translation_scheduler_completed",
    ok: true,
    outcome: "delivered",
    status: 200,
    durationMs: 42,
  });
  assert.doesNotMatch(line, /authorization|bearer|secret|source|translated/i);
});

test("authorization, rate-limit, upstream, and zero-work responses never retry", async () => {
  for (const [status, outcome] of [
    [200, "delivered"],
    [401, "authentication_rejected"],
    [403, "authentication_rejected"],
    [429, "rate_limited"],
    [500, "upstream_error"],
  ]) {
    let calls = 0;
    const result = await invokeBorikiTranslationWorker({
      secret: "synthetic-scheduler-secret",
      fetchImpl: async () => {
        calls += 1;
        return response(status);
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.outcome, outcome);
    assert.equal(result.status, status);
  }
});

test("a response-body cancellation failure does not mask successful delivery", async () => {
  let calls = 0;
  const result = await invokeBorikiTranslationWorker({
    secret: "synthetic-scheduler-secret",
    fetchImpl: async () => {
      calls += 1;
      return {
        ok: true,
        status: 200,
        body: {
          cancel: async () => {
            throw new Error("synthetic stream cancellation failure");
          },
        },
      };
    },
  });

  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: true, outcome: "delivered", status: 200 });
});

test("timeout and network failures are sanitized and never retried", async () => {
  const logs = [];
  let timeoutCalls = 0;
  const timeout = await invokeBorikiTranslationWorker({
    secret: "synthetic-scheduler-secret",
    timeoutMs: 5,
    fetchImpl: async (_url, init) => {
      timeoutCalls += 1;
      await new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => {
          const error = new Error("sensitive upstream detail");
          error.name = "AbortError";
          reject(error);
        });
      });
    },
    logger: (event, details) => logs.push({ event, details }),
  });
  assert.equal(timeoutCalls, 1);
  assert.equal(timeout.outcome, "request_timeout");

  let failureCalls = 0;
  const failure = await invokeBorikiTranslationWorker({
    secret: "synthetic-scheduler-secret",
    fetchImpl: async () => {
      failureCalls += 1;
      throw new Error("credential and response payload must stay private");
    },
    logger: (event, details) => logs.push({ event, details }),
  });
  assert.equal(failureCalls, 1);
  assert.equal(failure.outcome, "request_failed");
  assert.equal(logs.at(-1).details.failureClass, "unknown");
  assert.doesNotMatch(
    JSON.stringify(logs),
    /synthetic-scheduler-secret|sensitive|credential|payload/
  );
});
