import LocalizedNotFound from "@/components/LocalizedNotFound";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

export default function NotFound() {
  return <LocalizedNotFound locale={DEFAULT_LOCALE} />;
}
