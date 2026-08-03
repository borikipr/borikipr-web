import { generateLocalizedBuyerProfileMetadata, renderPerfilCompradorPropiedadPage } from "../../../../listados/[slug]/perfil-comprador/page";
import { ENGLISH_LOCALE, isMultilingualEnabled } from "@/lib/i18n/locales";
import { notFound } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return generateLocalizedBuyerProfileMetadata(params, ENGLISH_LOCALE);
}

export default function EnglishPropertyBuyerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  if (!isMultilingualEnabled()) notFound();
  return renderPerfilCompradorPropiedadPage({ params, locale: ENGLISH_LOCALE });
}
