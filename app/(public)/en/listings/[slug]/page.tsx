import { renderPropertyDetailPage } from "../../../listados/[slug]/page";
import { ENGLISH_LOCALE, isMultilingualEnabled } from "@/lib/i18n/locales";
import { notFound } from "next/navigation";

export default function EnglishPropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isMultilingualEnabled()) notFound();
  return renderPropertyDetailPage({ params, locale: ENGLISH_LOCALE });
}
