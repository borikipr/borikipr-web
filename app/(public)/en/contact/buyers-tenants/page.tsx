import { renderCompradoresArrendatariosPage } from "../../../contact/compradores-arrendatarios/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildLocalizedMetadata } from "@/lib/i18n/seo";
import { getPublicFormText } from "@/lib/i18n/public-form-copy";

const spanishPath = "/contact/compradores-arrendatarios";
const title = getPublicFormText(ENGLISH_LOCALE, "Formulario para Compradores y Arrendatarios");
const description = getPublicFormText(ENGLISH_LOCALE, "Solicita orientación para comprar o alquilar tu propiedad ideal en Puerto Rico");

export const metadata = buildLocalizedMetadata({ locale: ENGLISH_LOCALE, spanishPath, title, description });

export default function EnglishBuyerTenantFormPage() {
  return renderCompradoresArrendatariosPage(ENGLISH_LOCALE);
}
