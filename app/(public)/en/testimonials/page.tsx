import { renderTestimonialsPage } from "../../testimonios/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";

export default function EnglishTestimonialsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return renderTestimonialsPage({ searchParams, locale: ENGLISH_LOCALE });
}
