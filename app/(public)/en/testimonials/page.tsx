import { renderTestimonialsPage } from "../../testimonios/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";

export const metadata = buildStaticPageMetadata("testimonials", ENGLISH_LOCALE);

export default function EnglishTestimonialsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  return renderTestimonialsPage({ searchParams, locale: ENGLISH_LOCALE });
}
