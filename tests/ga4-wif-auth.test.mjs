import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("GA4 uses Vercel OIDC and Google external-account credentials", async () => {
  const [auth, provider] = await Promise.all([
    read("lib/admin/analytics/providers/ga4-auth.ts"),
    read("lib/admin/analytics/providers/ga4.ts"),
  ]);

  assert.match(auth, /import \{ getVercelOidcToken \} from "@vercel\/oidc"/);
  assert.match(auth, /ExternalAccountClient\.fromJSON/);
  assert.match(auth, /subject_token_supplier/);
  assert.match(auth, /getVercelOidcToken\(\{ audience \}\)/);
  assert.match(auth, /iamcredentials\.googleapis\.com/);
  assert.match(provider, /authClient: createGa4WifAuthClient\(wifConfig\)/);
});

test("GA4 WIF configuration fails closed and accepts no arbitrary provider resource", async () => {
  const auth = await read("lib/admin/analytics/providers/ga4-auth.ts");

  assert.match(auth, /providerResourcePattern/);
  assert.match(auth, /locations\\\/global/);
  assert.match(auth, /return null/);
  assert.match(auth, /if \(!authClient\)/);
});

test("GA4 production authentication is WIF-only and has no private-key fallback", async () => {
  const [auth, provider, env, types, overview] = await Promise.all([
    read("lib/admin/analytics/providers/ga4-auth.ts"),
    read("lib/admin/analytics/providers/ga4.ts"),
    read(".env.example"),
    read("lib/admin/analytics/types.ts"),
    read("app/admin/analytics/page.tsx"),
  ]);
  const runtime = `${auth}\n${provider}\n${types}\n${overview}`;

  assert.doesNotMatch(runtime, /GA4_AUTH_MODE/);
  assert.doesNotMatch(runtime, /GA4_PRIVATE_KEY/);
  assert.doesNotMatch(runtime, /private_key/);
  assert.doesNotMatch(env, /GA4_PRIVATE_KEY=/);
  assert.doesNotMatch(env, /GA4_AUTH_MODE=/);
  assert.match(env, /GA4_WORKLOAD_IDENTITY_PROVIDER_RESOURCE=/);
  assert.match(env, /GA4_GCP_PROJECT_ID=/);
});

test("GA4 WIF remains server-only and requests only Analytics read access", async () => {
  const [auth, provider] = await Promise.all([
    read("lib/admin/analytics/providers/ga4-auth.ts"),
    read("lib/admin/analytics/providers/ga4.ts"),
  ]);

  assert.match(provider, /^import "server-only";/);
  assert.match(auth, /https:\/\/www\.googleapis\.com\/auth\/analytics\.readonly/);
  assert.doesNotMatch(auth, /cloud-platform/);
  assert.doesNotMatch(auth, /NEXT_PUBLIC_/);
});

test("production build canary exercises WIF and a minimal GA4 read without data output", async () => {
  const canary = await read("scripts/analytics/verify-ga4-wif.ts");

  assert.match(canary, /GA4_WIF_BUILD_CANARY/);
  assert.match(canary, /createGa4WifAuthClient/);
  assert.match(canary, /client\.runReport/);
  assert.match(canary, /metrics: \[\{ name: "totalUsers" \}\]/);
  assert.doesNotMatch(canary, /console\.log\([^)]*(response|rows|token|credential)/i);
});
