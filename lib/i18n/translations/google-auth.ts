import "server-only";
import type { AuthClient } from "google-auth-library";
import {
  assertGoogleAuthenticationConfig,
  type GoogleAuthenticationConfig,
} from "@/lib/i18n/translations/google-auth-config";

type ExternalAccountConfiguration = {
  type: "external_account";
  audience: string;
  subject_token_type: "urn:ietf:params:oauth:token-type:jwt";
  token_url: "https://sts.googleapis.com/v1/token";
  service_account_impersonation_url: string;
  subject_token_supplier: { getSubjectToken(): Promise<string> };
};

type ExternalAccountFactory = (
  configuration: ExternalAccountConfiguration
) => AuthClient | null;

export async function createVercelWorkloadIdentityAuthClient(
  config: Extract<GoogleAuthenticationConfig, { mode: "vercel-wif" }>,
  dependencies: {
    getVercelOidcToken?: () => Promise<string>;
    externalAccountFactory?: ExternalAccountFactory;
  } = {}
) {
  assertGoogleAuthenticationConfig(config);
  const getToken =
    dependencies.getVercelOidcToken ??
    (async () => {
      const { getVercelOidcToken } = await import("@vercel/oidc");
      return getVercelOidcToken();
    });
  const factory =
    dependencies.externalAccountFactory ??
    ((await import("google-auth-library")).ExternalAccountClient
      .fromJSON as ExternalAccountFactory);
  const authClient = factory({
    type: "external_account",
    audience: config.workloadIdentityAudience,
    subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
    token_url: "https://sts.googleapis.com/v1/token",
    service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccountEmail}:generateAccessToken`,
    subject_token_supplier: {
      async getSubjectToken() {
        const token = await getToken();
        if (!token || !token.trim()) {
          throw new Error("Vercel OIDC token is unavailable.");
        }
        return token;
      },
    },
  });
  if (!authClient) {
    throw new Error("Google external account client could not be created.");
  }
  return authClient;
}
