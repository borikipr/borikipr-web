import { generateLocalizedPriorityRegistrationMetadata, renderRegistroPrioritarioPage } from "../../../../properties/[slug]/registro-prioritario/page";
import { ENGLISH_LOCALE, isMultilingualEnabled } from "@/lib/i18n/locales";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return generateLocalizedPriorityRegistrationMetadata(params, ENGLISH_LOCALE);
}

export default function EnglishPriorityRegistrationPage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isMultilingualEnabled()) notFound();
  return renderRegistroPrioritarioPage({ params, locale: ENGLISH_LOCALE });
}
