import Header from "@/components/Header";
import Image from "next/image";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPropiedadBySlug } from "@/lib/queries/propiedades";
import { isPrivateR2Configured } from "@/lib/r2";
import PerfilCompradorPropiedadForm from "@/components/PerfilCompradorPropiedadForm";
import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { getCanonicalOpenHouseShowingAt } from "@/lib/leads/postgres-open-house-registration";
import { DEFAULT_LOCALE, ENGLISH_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { getPublicFormText } from "@/lib/i18n/public-form-copy";
import { overlayPropertyTranslations } from "@/lib/i18n/translations/public-overlay";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateLocalizedOpenHouseMetadata(params: PageProps["params"], locale: AppLocale): Promise<Metadata> {
  const { slug } = await params;

  return {
    robots: {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
      },
    },
    alternates: {
      canonical: getEquivalentRoute(`/listados/${slug}`, locale) ?? `/listados/${slug}`,
    },
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return generateLocalizedOpenHouseMetadata(params, DEFAULT_LOCALE);
}

function formatoPrecio(precio: string | number) {
  const numericPrice = Number(precio);

  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return "Precio próximamente";
  }

  return `$${numericPrice.toLocaleString("en-US")}`;
}

function formatoFechaOpenHouse(
  value: string | Date | null | undefined,
  locale: AppLocale = DEFAULT_LOCALE
) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Puerto_Rico",
  }).format(date);
}

export async function renderOpenHouseRegistrationPage({
  params,
  locale,
}: PageProps & { locale: AppLocale }) {
  const { slug } = await params;
  const source = await getPropiedadBySlug(slug);

  if (!source) {
    notFound();
  }
  const propiedad = locale === ENGLISH_LOCALE
    ? (await overlayPropertyTranslations({ properties: [source], locale }))[0]
    : source;
  const t = (value: string) => getPublicFormText(locale, value);

  const canonicalShowingAt = await getCanonicalOpenHouseShowingAt(propiedad.id);

  const imagenPrincipal =
    Array.isArray(propiedad.imagenes) && propiedad.imagenes.length > 0
      ? propiedad.imagenes[0]
      : "/og-image.jpg";
  const openHouseActivo =
    Boolean(propiedad.formulario_showing_activo) &&
    Boolean(propiedad.fecha_showing);
  const fechaOpenHouse = formatoFechaOpenHouse(
    canonicalShowingAt || propiedad.fecha_showing,
    locale
  );
  const notasCompradores = propiedad.notas_compradores ?? "";

  return (
    <>
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-12">
          <Link
            href={getEquivalentRoute(`/listados/${propiedad.slug}`, locale) ?? `/listados/${propiedad.slug}`}
            className="inline-flex text-sm font-semibold text-[#11518b] transition hover:text-[#0d406d]"
          >
            {t("Volver a la propiedad")}
          </Link>

          <div className="mt-8 grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <aside className="lg:sticky lg:top-[112px]">
              <div className="overflow-hidden rounded-2xl border border-[#e8e8e8] bg-white shadow-sm">
                <div className="relative aspect-[4/3] bg-[#f5f5f5]">
                  <Image
                    src={imagenPrincipal}
                    alt={propiedad.titulo}
                    fill
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className="object-cover"
                  />
                </div>
                <div className="space-y-4 p-6">
                  <p className="eyebrow">Open House</p>
                  <h1 className="text-3xl font-bold leading-tight text-[#000000]">
                    {propiedad.titulo}
                  </h1>
                  <div className="grid gap-3 text-sm text-[#4d4d4d] sm:grid-cols-2">
                    <p>
                      <span className="font-semibold text-[#000000]">
                        {t("Municipio:")}
                      </span>{" "}
                      {formatPropertyLocation(
                        propiedad.municipio,
                        propiedad.sector_comunidad
                      )}
                    </p>
                    <p>
                      <span className="font-semibold text-[#000000]">
                        {t("Precio:")}
                      </span>{" "}
                      {Number(propiedad.precio) > 0 ? formatoPrecio(propiedad.precio) : t("Precio próximamente")}
                    </p>
                  </div>
                  {fechaOpenHouse && (
                    <div className="rounded-xl border border-[#d4af37] bg-[#fff9e6] p-4">
                      <p className="text-sm font-semibold text-[#000000]">
                        Open House
                      </p>
                      <p className="mt-1 text-sm text-[#4d4d4d]">
                        {fechaOpenHouse}
                      </p>
                    </div>
                  )}
                  {locale === DEFAULT_LOCALE && notasCompradores && (
                    <div className="rounded-xl border border-[#e8e8e8] bg-[#f8f8f8] p-4 text-sm text-[#4d4d4d]">
                      {notasCompradores}
                    </div>
                  )}
                </div>
              </div>
            </aside>

            <section className="surface-card p-6 md:p-10">
              {openHouseActivo ? (
                <>
                  <div className="mb-8">
                    <p className="eyebrow">{t("Confirmación de asistencia")}</p>
                    <h2 className="mt-3 text-3xl font-bold text-[#000000]">
                      {t("Confirma tu asistencia al Open House")}
                    </h2>
                    <p className="mt-4 text-[#4d4d4d]">
                      {t("Confirma si podrás asistir en la fecha y hora indicadas y comparte la información necesaria para preparar tu visita.")}
                    </p>
                  </div>

                  <PerfilCompradorPropiedadForm
                    workflow="open_house"
                    propiedadId={propiedad.id}
                    propiedadSlug={propiedad.slug}
                    showingAt={canonicalShowingAt || ""}
                    requiresSolarContractAcceptance={
                      propiedad.open_house_solar_question_enabled === true
                    }
                    r2Configured={isPrivateR2Configured()}
                  />
                </>
              ) : (
                <div className="py-10 text-center">
                  <p className="eyebrow">{t("Formulario no disponible")}</p>
                  <h2 className="mt-3 text-3xl font-bold text-[#000000]">
                    {t("Aún no hay un Open House activo para esta propiedad")}
                  </h2>
                  <p className="mx-auto mt-4 max-w-xl text-[#4d4d4d]">
                    {t("Cuando Ivonne confirme la fecha y la hora, el registro para el Open House estará disponible aquí.")}
                  </p>
                  <div className="mt-8">
                    <Link
                      href={getEquivalentRoute(`/listados/${propiedad.slug}`, locale) ?? `/listados/${propiedad.slug}`}
                      className="btn-primary"
                    >
                      {t("Ver detalles de la propiedad")}
                    </Link>
                  </div>
                </div>
              )}
            </section>
          </div>
        </section>
      </main>
    </>
  );
}

export default function OpenHouseRegistrationPage(props: PageProps) {
  return renderOpenHouseRegistrationPage({ ...props, locale: DEFAULT_LOCALE });
}
