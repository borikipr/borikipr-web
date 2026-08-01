import "server-only";
import { v3 } from "@google-cloud/translate";
import { createVercelWorkloadIdentityAuthClient } from "@/lib/i18n/translations/google-auth";
import type { GoogleAuthenticationConfig } from "@/lib/i18n/translations/google-auth-config";
import type { OfficialGoogleTranslationClient } from "@/lib/i18n/translations/google-transport";

export async function createOfficialGoogleClient(
  input: { authentication: GoogleAuthenticationConfig },
  dependencies: {
    createWifAuthClient?: typeof createVercelWorkloadIdentityAuthClient;
    translationClientFactory?: (
      options?: ConstructorParameters<typeof v3.TranslationServiceClient>[0]
    ) => OfficialGoogleTranslationClient;
  } = {}
): Promise<OfficialGoogleTranslationClient> {
  const createTranslationClient =
    dependencies.translationClientFactory ??
    ((options) =>
      new v3.TranslationServiceClient(options) as OfficialGoogleTranslationClient);
  if (input.authentication.mode === "adc") {
    return createTranslationClient();
  }
  const authClient = await (
    dependencies.createWifAuthClient ?? createVercelWorkloadIdentityAuthClient
  )(
    input.authentication
  );
  return createTranslationClient({
    authClient: authClient as never,
  });
}
