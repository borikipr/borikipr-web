import { renderPrivacyPage } from "../../privacidad/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";

export const metadata = buildStaticPageMetadata("privacy", ENGLISH_LOCALE);

export default function EnglishPrivacyPage() {
  return renderPrivacyPage(ENGLISH_LOCALE);
}
