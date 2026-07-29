import { renderHomePage } from "../page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";

export default function EnglishHomePage() {
  return renderHomePage(ENGLISH_LOCALE);
}
