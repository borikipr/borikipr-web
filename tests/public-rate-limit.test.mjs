import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ||= "postgresql://local-test.invalid/neondb";
process.env.PUBLIC_RATE_LIMIT_SECRET =
  "synthetic-public-rate-limit-secret-at-least-32-characters";

const {
  checkRateLimit,
  getClientIp,
  normalizeIpAddress,
} = await import("../lib/rate-limit.ts");

const migration = await readFile(
  new URL("../db/migrations/0017_create_public_rate_limits.sql", import.meta.url),
  "utf8"
);

function adapter(db) {
  return {
    async unsafe(query, parameters = []) {
      return (await db.query(query, parameters)).rows;
    },
  };
}

test("durable limits cannot be bypassed by a second simulated server instance", async () => {
  const db = new PGlite();
  try {
    await db.exec(migration);
    const firstInstance = adapter(db);
    const coldStartInstance = adapter(db);
    const clock = { now: () => Date.UTC(2026, 6, 28, 12, 0, 0) };
    const options = {
      key: "open-house-registration:203.0.113.10",
      limit: 2,
      windowMs: 10 * 60 * 1000,
    };
    assert.equal((await checkRateLimit(options, firstInstance, clock)).allowed, true);
    assert.equal((await checkRateLimit(options, coldStartInstance, clock)).allowed, true);
    assert.equal((await checkRateLimit(options, firstInstance, clock)).allowed, false);

    const stored = await db.query(
      `SELECT action_type, identifier_hash, request_count
       FROM public.public_rate_limit_buckets`
    );
    assert.equal(stored.rows.length, 1);
    assert.equal(stored.rows[0].action_type, "open-house-registration");
    assert.equal(stored.rows[0].identifier_hash.length, 64);
    assert.equal(stored.rows[0].identifier_hash.includes("203.0.113.10"), false);
    assert.equal(stored.rows[0].request_count, 2);
  } finally {
    await db.close();
  }
});

test("new windows and different actions remain independently usable", async () => {
  const db = new PGlite();
  try {
    await db.exec(migration);
    const database = adapter(db);
    const base = Date.UTC(2026, 6, 28, 12, 0, 0);
    const options = {
      key: "document-status:2001:db8::1",
      limit: 1,
      windowMs: 60_000,
    };
    assert.equal(
      (await checkRateLimit(options, database, { now: () => base })).allowed,
      true
    );
    assert.equal(
      (await checkRateLimit(options, database, { now: () => base + 1_000 })).allowed,
      false
    );
    assert.equal(
      (
        await checkRateLimit(
          { ...options, key: "open-house-registration:2001:db8::1" },
          database,
          { now: () => base + 1_000 }
        )
      ).allowed,
      true
    );
    assert.equal(
      (
        await checkRateLimit(options, database, {
          now: () => base + 60_000,
        })
      ).allowed,
      true
    );
  } finally {
    await db.close();
  }
});

test("IP parsing normalizes IPv4 and IPv6 and trusts only deployment headers", () => {
  assert.equal(normalizeIpAddress("203.0.113.7:443"), "203.0.113.7");
  assert.equal(normalizeIpAddress("::ffff:203.0.113.7"), "203.0.113.7");
  assert.equal(
    normalizeIpAddress("2001:0db8:0000:0000:0000:0000:0000:0001"),
    "2001:db8::1"
  );
  assert.equal(normalizeIpAddress("not-an-ip"), "unknown");

  const originalVercel = process.env.VERCEL;
  const originalNodeEnv = process.env.NODE_ENV;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.VERCEL;
    assert.equal(
      getClientIp(
        new Request("https://example.test", {
          headers: { "x-forwarded-for": "198.51.100.99" },
        })
      ),
      "unknown"
    );

    process.env.VERCEL = "1";
    assert.equal(
      getClientIp(
        new Request("https://example.test", {
          headers: {
            "x-vercel-forwarded-for": "2001:db8::5",
            "x-forwarded-for": "198.51.100.200",
          },
        })
      ),
      "2001:db8::5"
    );

    delete process.env.VERCEL;
    assert.equal(
      getClientIp(
        new Request("https://example.test", {
          headers: {
            "cf-ray": "synthetic",
            "cf-connecting-ip": "198.51.100.8",
          },
        })
      ),
      "198.51.100.8"
    );
  } finally {
    if (originalVercel === undefined) delete process.env.VERCEL;
    else process.env.VERCEL = originalVercel;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  }
});

test("a missing HMAC secret fails closed before writing a bucket", async () => {
  const originalSecret = process.env.PUBLIC_RATE_LIMIT_SECRET;
  delete process.env.PUBLIC_RATE_LIMIT_SECRET;
  try {
    await assert.rejects(
      checkRateLimit(
        {
          key: "fixture:203.0.113.1",
          limit: 5,
          windowMs: 60_000,
        },
        { unsafe: async () => assert.fail("database must not be called") }
      ),
      /not configured securely/
    );
  } finally {
    process.env.PUBLIC_RATE_LIMIT_SECRET = originalSecret;
  }
});

test("all public endpoints await the durable limiter and no process Map remains", async () => {
  const root = new URL("..", import.meta.url);
  const rateLimitSource = await readFile(new URL("lib/rate-limit.ts", root), "utf8");
  assert.doesNotMatch(rateLimitSource, /new Map/);
  assert.match(rateLimitSource, /public_rate_limit_buckets/);
  assert.match(rateLimitSource, /createHmac\("sha256"/);

  const sources = await Promise.all(
    [
      "lib/leads/buyer-tenant-inquiry-handler.ts",
      "lib/leads/seller-landlord-inquiry-handler.ts",
      "lib/leads/property-buyer-profile-handler.ts",
      "lib/leads/open-house-registration-handler.ts",
      "app/api/registro-prioritario/route.ts",
      "app/api/consultas-propiedad/document-status/route.ts",
    ].map((path) => readFile(new URL(path, root), "utf8"))
  );
  for (const source of sources) {
    assert.match(source, /await checkRateLimit\(/);
  }
});
