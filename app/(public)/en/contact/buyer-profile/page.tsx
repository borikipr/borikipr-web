import { renderPerfilCompradorPage } from "../../../contact/perfil-comprador/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildLocalizedMetadata } from "@/lib/i18n/seo";
import { getPublicFormText } from "@/lib/i18n/public-form-copy";

const spanishPath = "/contact/perfil-comprador";
const title = getPublicFormText(ENGLISH_LOCALE, "Perfil del Cliente Comprador");
const description = getPublicFormText(ENGLISH_LOCALE, "Selecciona una propiedad disponible antes de completar tu perfil de comprador.");

export const metadata = buildLocalizedMetadata({ locale: ENGLISH_LOCALE, spanishPath, title, description });

export default function EnglishBuyerProfileLandingPage() {
  return renderPerfilCompradorPage(ENGLISH_LOCALE);
}
