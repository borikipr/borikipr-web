import LocalizedNotFound from "@/components/LocalizedNotFound";
import {
  DEFAULT_LOCALE,
  ENGLISH_LOCALE,
  isMultilingualEnabled,
} from "@/lib/i18n/locales";

export default function EnglishNotFound() {
  const locale = isMultilingualEnabled() ? ENGLISH_LOCALE : DEFAULT_LOCALE;
  return <LocalizedNotFound locale={locale} />;
}
