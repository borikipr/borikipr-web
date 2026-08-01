import { renderAboutPage } from "../../about/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";

export const metadata = buildStaticPageMetadata("about", ENGLISH_LOCALE);

export default function EnglishAboutPage() {
  return renderAboutPage(ENGLISH_LOCALE);
}
