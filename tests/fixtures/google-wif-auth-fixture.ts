import assert from "node:assert/strict";
import { createOfficialGoogleClient } from "../../lib/i18n/translations/google-client";
import { createVercelWorkloadIdentityAuthClient } from "../../lib/i18n/translations/google-auth";
import { buildGoogleWorkloadIdentityAudience } from "../../lib/i18n/translations/google-auth-config";

async function main() {
const config = {
  mode: "vercel-wif" as const,
  projectNumber: "123456789012",
  serviceAccountEmail:
    "borikipr-translation-worker@fixture-project.iam.gserviceaccount.com",
  workloadIdentityPoolId: "vercel-prod",
  workloadIdentityProviderId: "vercel-prod",
  workloadIdentityAudience: buildGoogleWorkloadIdentityAudience({
    projectNumber: "123456789012",
    poolId: "vercel-prod",
    providerId: "vercel-prod",
  }),
};

let tokenCalls = 0;
type CapturedExternalConfiguration = {
  subject_token_supplier: { getSubjectToken(): Promise<string> };
  audience: string;
  token_url: string;
  service_account_impersonation_url: string;
};
let externalConfiguration: CapturedExternalConfiguration | null = null;
const authClient = await createVercelWorkloadIdentityAuthClient(config, {
  getVercelOidcToken: async () => {
    tokenCalls += 1;
    return "fixture-token-not-a-secret";
  },
  externalAccountFactory(configuration) {
    externalConfiguration = configuration;
    return { fixture: true } as never;
  },
});
assert.equal(tokenCalls, 0);
assert.ok(externalConfiguration);
const capturedConfiguration =
  externalConfiguration as CapturedExternalConfiguration;
assert.equal(capturedConfiguration.audience, config.workloadIdentityAudience);
assert.equal(capturedConfiguration.token_url, "https://sts.googleapis.com/v1/token");
assert.match(
  capturedConfiguration.service_account_impersonation_url,
  /iamcredentials\.googleapis\.com/
);
assert.equal(
  await capturedConfiguration.subject_token_supplier.getSubjectToken(),
  "fixture-token-not-a-secret"
);
assert.equal(tokenCalls, 1);

let receivedOptions: Record<string, unknown> | undefined;
const translationClient = { translateText() {} } as never;
const created = await createOfficialGoogleClient(
  { authentication: config },
  {
    createWifAuthClient: async () => authClient,
    translationClientFactory(options) {
      receivedOptions = options as Record<string, unknown>;
      return translationClient;
    },
  }
);
assert.equal(created, translationClient);
assert.equal(receivedOptions?.authClient, authClient);
assert.equal(tokenCalls, 1);

console.info(
  JSON.stringify({
    authClientCreated: true,
    tokenRetrievedOnlyBySupplier: true,
    authPassedToTranslationClient: true,
  })
);
}

void main();
