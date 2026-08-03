import { generateLocalizedOpenHouseMetadata, renderOpenHouseRegistrationPage } from "../../../../listados/[slug]/registro-openhouse/page";
import { ENGLISH_LOCALE, isMultilingualEnabled } from "@/lib/i18n/locales";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return generateLocalizedOpenHouseMetadata(params, ENGLISH_LOCALE);
}

export default function EnglishOpenHouseRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isMultilingualEnabled()) notFound();
  return renderOpenHouseRegistrationPage({ params, locale: ENGLISH_LOCALE });
}
