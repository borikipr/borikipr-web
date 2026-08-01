import "server-only";
import { v3 } from "@google-cloud/translate";
import type { OfficialGoogleTranslationClient } from "@/lib/i18n/translations/google-transport";

export function createOfficialGoogleClient(): OfficialGoogleTranslationClient {
  return new v3.TranslationServiceClient() as OfficialGoogleTranslationClient;
}
