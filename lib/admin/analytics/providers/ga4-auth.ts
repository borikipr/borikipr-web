import { getVercelOidcToken } from "@vercel/oidc";
import {
  ExternalAccountClient,
  type AuthClient,
} from "google-auth-library";

const analyticsReadonlyScope =
  "https://www.googleapis.com/auth/analytics.readonly";
const providerResourcePattern =
  /^projects\/\d+\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/;

export type Ga4WifConfig = {
  projectId: string;
  serviceAccountEmail: string;
  providerResource: string;
};

export function getGa4WifConfig(): Ga4WifConfig | null {
  const projectId = process.env.GA4_GCP_PROJECT_ID?.trim();
  const serviceAccountEmail = process.env.GA4_CLIENT_EMAIL?.trim();
  const providerResource =
    process.env.GA4_WORKLOAD_IDENTITY_PROVIDER_RESOURCE?.trim();

  if (
    !projectId ||
    !serviceAccountEmail ||
    !providerResource ||
    !providerResourcePattern.test(providerResource)
  ) {
    return null;
  }

  return { projectId, serviceAccountEmail, providerResource };
}

export function createGa4WifAuthClient(config: Ga4WifConfig): AuthClient {
  const audience = `https://iam.googleapis.com/${config.providerResource}`;
  const authClient = ExternalAccountClient.fromJSON({
    type: "external_account",
    audience: `//iam.googleapis.com/${config.providerResource}`,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url:
      `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/` +
      `${encodeURIComponent(config.serviceAccountEmail)}:generateAccessToken`,
    service_account_impersonation: {
      token_lifetime_seconds: 3600,
    },
    scopes: [analyticsReadonlyScope],
    subject_token_supplier: {
      getSubjectToken: () => getVercelOidcToken({ audience }),
    },
  });

  if (!authClient) {
    throw new Error("GA4 Workload Identity Federation is not configured correctly.");
  }

  return authClient;
}
