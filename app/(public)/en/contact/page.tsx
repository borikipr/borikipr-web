import { renderContactPage } from "../../contact/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";

export const metadata = buildStaticPageMetadata("contact", ENGLISH_LOCALE);

export default function EnglishContactPage() {
  return renderContactPage(ENGLISH_LOCALE);
}
