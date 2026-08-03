import { renderVendedorArrendadorPage } from "../../../contact/vendedor-arrendador/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildLocalizedMetadata } from "@/lib/i18n/seo";
import { getPublicFormText } from "@/lib/i18n/public-form-copy";

const spanishPath = "/contact/vendedor-arrendador";
const title = getPublicFormText(ENGLISH_LOCALE, "Formulario para Vendedores y Arrendadores");
const description = getPublicFormText(ENGLISH_LOCALE, "Solicita orientación para vender o alquilar tu propiedad en Puerto Rico");

export const metadata = buildLocalizedMetadata({ locale: ENGLISH_LOCALE, spanishPath, title, description });

export default function EnglishSellerLandlordFormPage() {
  return renderVendedorArrendadorPage(ENGLISH_LOCALE);
}
