import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";

process.env.DATABASE_URL ||= "postgresql://local-test.invalid/neondb";
process.env.CRON_SECRET = "synthetic-cron-secret";

const root = fileURLToPath(new URL("..", import.meta.url));
const [
  migration,
  maintenanceSource,
  rootLayoutSource,
  publicLayoutSource,
  adminLayoutSource,
  adminFooterSource,
  vercelConfig,
  publicRateLimitMigration,
] = await Promise.all([
  readFile(`${root}/db/migrations/0013_extend_admin_authentication.sql`, "utf8"),
  readFile(`${root}/lib/admin/auth-maintenance.ts`, "utf8"),
  readFile(`${root}/app/layout.tsx`, "utf8"),
  readFile(`${root}/app/(public)/layout.tsx`, "utf8"),
  readFile(`${root}/app/admin/layout.tsx`, "utf8"),
  readFile(`${root}/components/admin/AdminFooter.tsx`, "utf8"),
  readFile(`${root}/vercel.json`, "utf8").then(JSON.parse),
  readFile(`${root}/db/migrations/0017_create_public_rate_limits.sql`, "utf8"),
]);

const {
  AUTH_ATTEMPT_RETENTION_DAYS,
  PUBLIC_RATE_LIMIT_RETENTION_DAYS,
  RESET_TOKEN_RETENTION_DAYS,
  cleanupAdminAuthenticationRecords,
} = await import("../lib/admin/auth-maintenance.ts");
const { handleAdminAuthCleanupRequest } = await import(
  "../app/api/cron/cleanup-admin-auth/route.ts"
);
const {
  parseAdminSessionValue,
  signAdminSessionPayload,
} = await import("../lib/admin/auth-core.ts");

const db = new PGlite();
const adminId = "00000000-0000-4000-8000-000000000001";

function adapter() {
  return {
    begin: (callback) =>
      db.transaction((transaction) =>
        callback({
          unsafe: async (query, parameters = []) =>
            (await transaction.query(query, parameters)).rows,
        })
      ),
  };
}

before(async () => {
  await db.exec(`
    CREATE TABLE public.admin_users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      activo boolean NOT NULL DEFAULT true,
      created_at timestamp NOT NULL DEFAULT now()
    );
  `);
  await db.exec(migration);
  await db.exec(publicRateLimitMigration);
  await db.query(
    `INSERT INTO public.admin_users (
       id, username, password_hash, activo, display_name, email, session_version
     ) VALUES ($1::uuid, 'synthetic-admin', 'unchanged-password-hash', true,
       'Synthetic Admin', 'synthetic@example.test', 7)`,
    [adminId]
  );
  await db.query(
    `INSERT INTO public.public_rate_limit_buckets (
       action_type, identifier_hash, bucket_start, window_seconds,
       request_count, expires_at
     ) VALUES
       ('fixture', $1, now() - interval '3 days', 600, 1, now() - interval '2 days'),
       ('fixture', $2, now(), 600, 1, now() + interval '10 minutes')`,
    ["3".repeat(64), "4".repeat(64)]
  );

  const tokens = [
    ["a".repeat(64), "20 days", "1 day", null],
    ["b".repeat(64), "10 days", "-2 days", null],
    ["c".repeat(64), "20 days", "-8 days", null],
    ["d".repeat(64), "10 days", "-9 days", "-2 days"],
    ["e".repeat(64), "20 days", "-19 days", "-8 days"],
  ];
  for (const [hash, createdAgo, expiresFromNow, usedFromNow] of tokens) {
    await db.query(
      `INSERT INTO public.admin_password_reset_tokens (
         admin_user_id, token_hash, created_at, expires_at, used_at
       ) VALUES (
         $1::uuid, $2,
         now() - $3::interval,
         now() + $4::interval,
         CASE WHEN $5::text IS NULL THEN NULL ELSE now() + $5::interval END
       )`,
      [adminId, hash, createdAgo, expiresFromNow, usedFromNow]
    );
  }

  await db.query(
    `INSERT INTO public.admin_auth_attempts (
       identifier_hash, attempt_type, succeeded, created_at
     ) VALUES
       ($1, 'login', false, now() - interval '1 day'),
       ($2, 'password_reset_request', true, now() - interval '91 days')`,
    ["1".repeat(64), "2".repeat(64)]
  );
});

after(async () => {
  await db.close();
});

test("retention constants preserve valid security windows", () => {
  assert.equal(RESET_TOKEN_RETENTION_DAYS, 7);
  assert.equal(AUTH_ATTEMPT_RETENTION_DAYS, 90);
  assert.equal(PUBLIC_RATE_LIMIT_RETENTION_DAYS, 1);
});

test("cleanup removes only old expired, used, and attempt records", async () => {
  const adminBefore = (
    await db.query(
      `SELECT username, display_name, email, password_hash, session_version
       FROM public.admin_users WHERE id = $1::uuid`,
      [adminId]
    )
  ).rows[0];

  const result = await cleanupAdminAuthenticationRecords(adapter());
  assert.deepEqual(result, {
    expiredResetTokensDeleted: 1,
    usedResetTokensDeleted: 1,
    oldAuthAttemptsDeleted: 1,
    expiredPublicRateLimitBucketsDeleted: 1,
  });

  const tokenRows = (
    await db.query(
      `SELECT token_hash, used_at IS NOT NULL AS used
       FROM public.admin_password_reset_tokens
       ORDER BY token_hash`
    )
  ).rows;
  assert.deepEqual(
    tokenRows.map((row) => [row.token_hash[0], row.used]),
    [
      ["a", false],
      ["b", false],
      ["d", true],
    ]
  );

  const attempts = (
    await db.query(
      "SELECT count(*)::int AS count FROM public.admin_auth_attempts"
    )
  ).rows;
  assert.equal(attempts[0].count, 1);

  const adminAfter = (
    await db.query(
      `SELECT username, display_name, email, password_hash, session_version
       FROM public.admin_users WHERE id = $1::uuid`,
      [adminId]
    )
  ).rows[0];
  assert.deepEqual(adminAfter, adminBefore);
});

test("cleanup is idempotent", async () => {
  assert.deepEqual(await cleanupAdminAuthenticationRecords(adapter()), {
    expiredResetTokensDeleted: 0,
    usedResetTokensDeleted: 0,
    oldAuthAttemptsDeleted: 0,
    expiredPublicRateLimitBucketsDeleted: 0,
  });
});

test("cleanup does not invalidate a current cookie session", () => {
  const secret = "synthetic-session-secret-at-least-32-characters";
  const payload = {
    adminId,
    username: "synthetic-admin",
    sessionVersion: 7,
    expiresAt: 2_000,
  };
  const session = signAdminSessionPayload(payload, secret);
  assert.deepEqual(parseAdminSessionValue(session, secret, 1_000), payload);
  assert.doesNotMatch(maintenanceSource, /admin_users|session_version|password_hash/);
});

test("cron rejects unauthorized requests without running cleanup", async () => {
  let calls = 0;
  const response = await handleAdminAuthCleanupRequest(
    new Request("https://example.test/api/cron/cleanup-admin-auth"),
    async () => {
      calls += 1;
      return {
        expiredResetTokensDeleted: 0,
        usedResetTokensDeleted: 0,
        oldAuthAttemptsDeleted: 0,
        expiredPublicRateLimitBucketsDeleted: 0,
      };
    }
  );
  assert.equal(response.status, 401);
  assert.equal(calls, 0);
  assert.deepEqual(await response.json(), { ok: false, error: "Unauthorized" });
});

test("authorized cron returns aggregate counts only", async () => {
  const originalInfo = console.info;
  console.info = () => {};
  try {
    const response = await handleAdminAuthCleanupRequest(
      new Request("https://example.test/api/cron/cleanup-admin-auth", {
        headers: { authorization: "Bearer synthetic-cron-secret" },
      }),
      async () => ({
        expiredResetTokensDeleted: 2,
        usedResetTokensDeleted: 3,
        oldAuthAttemptsDeleted: 4,
        expiredPublicRateLimitBucketsDeleted: 5,
      })
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.expiredResetTokensDeleted, 2);
    assert.equal(body.usedResetTokensDeleted, 3);
    assert.equal(body.oldAuthAttemptsDeleted, 4);
    assert.equal(body.expiredPublicRateLimitBucketsDeleted, 5);
    assert.equal(typeof body.durationMs, "number");
    assert.deepEqual(
      Object.keys(body).sort(),
      [
        "durationMs",
        "expiredResetTokensDeleted",
        "ok",
        "oldAuthAttemptsDeleted",
        "expiredPublicRateLimitBucketsDeleted",
        "usedResetTokensDeleted",
      ].sort()
    );
  } finally {
    console.info = originalInfo;
  }
});

test("cron failure response and logs contain no database details", async () => {
  const originalError = console.error;
  const logs = [];
  console.error = (...values) => logs.push(values.join(" "));
  try {
    const response = await handleAdminAuthCleanupRequest(
      new Request("https://example.test/api/cron/cleanup-admin-auth", {
        headers: { authorization: "Bearer synthetic-cron-secret" },
      }),
      async () => {
        throw new Error("sensitive-token-hash");
      }
    );
    assert.equal(response.status, 500);
    assert.doesNotMatch(JSON.stringify(await response.json()), /sensitive|hash/i);
    assert.doesNotMatch(logs.join(" "), /sensitive|hash/i);
  } finally {
    console.error = originalError;
  }
});

test("cron is scheduled daily after the email queue job", () => {
  assert.deepEqual(vercelConfig.crons, [
    { path: "/api/cron/process-email-queue", schedule: "0 9 * * *" },
    { path: "/api/cron/cleanup-admin-auth", schedule: "17 9 * * *" },
  ]);
});

test("public footer lives only in the public route group", () => {
  assert.doesNotMatch(rootLayoutSource, /<Footer|components\/footer/);
  assert.match(publicLayoutSource, /<Footer \/>/);
  assert.match(publicLayoutSource, /components\/footer/);
});

test("admin routes use the restrained server-layout footer", () => {
  assert.match(adminLayoutSource, /<AdminFooter \/>/);
  assert.match(adminLayoutSource, /flex min-h-screen flex-col/);
  assert.match(adminFooterSource, /<footer/);
  assert.match(adminFooterSource, /Borikí Admin · Uso interno/);
  assert.match(adminFooterSource, /Erickson Real Estate/);
  assert.doesNotMatch(
    adminFooterSource,
    /usePathname|Facebook|Instagram|WhatsApp|Listados|Compra de propiedades|Ver website/
  );
});
