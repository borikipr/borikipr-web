import { renderHomePage } from "../page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";

export const metadata = buildStaticPageMetadata("home", ENGLISH_LOCALE);

export default function EnglishHomePage() {
  return renderHomePage(ENGLISH_LOCALE);
}
