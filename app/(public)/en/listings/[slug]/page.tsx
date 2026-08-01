import { generateLocalizedPropertyMetadata, renderPropertyDetailPage } from "../../../listados/[slug]/page";
import { ENGLISH_LOCALE, isMultilingualEnabled } from "@/lib/i18n/locales";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  if (!isMultilingualEnabled()) return { robots: { index: false, follow: false } };
  return generateLocalizedPropertyMetadata(params, ENGLISH_LOCALE);
}

export default function EnglishPropertyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  if (!isMultilingualEnabled()) notFound();
  return renderPropertyDetailPage({ params, locale: ENGLISH_LOCALE });
}
