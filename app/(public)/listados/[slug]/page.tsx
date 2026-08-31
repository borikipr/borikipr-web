import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import GaleriaPropiedad from "@/components/GaleriaPropiedad";
import AnalyticsEventOnView from "@/components/AnalyticsEventOnView";
import AnalyticsLink from "@/components/AnalyticsLink";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cache } from "react";
import {
  getPropiedadBySlug,
  getPropiedadesSimilares,
} from "@/lib/queries/propiedades";
import { TipoPropiedad } from "@/data/listados";
import WhatsAppTrackerButton from "@/components/WhatsAppTrackerButton";
import TrackLinkButton from "@/components/TrackLinkButton";
import ListingProfessionalCard from "@/components/ListingProfessionalCard";
import type { PublicListingProfessional } from "@/lib/queries/propiedades";
import {
  SITE_NAME,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";
import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { getEquivalentRoute } from "@/lib/i18n/routing";
import { overlayPropertyTranslations } from "@/lib/i18n/translations/public-overlay";
import { getPropertyTranslationSeoState } from "@/lib/i18n/translations/public-overlay";
import { buildPropertySeoMetadata, isCompleteEnglishPropertyTranslation, normalizeMetadataDescription } from "@/lib/i18n/seo";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";

type TipoNegocio = "venta" | "renta";
type EstadoPropiedad =
  | "disponible"
  | "coming_soon"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

type PropiedadDB = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  sector_comunidad?: string | null;
  precio: string | number;
  tipo_negocio: TipoNegocio;
  tipo_propiedad: TipoPropiedad;
  habitaciones: number;
  banos: number;
  estacionamientos: number;
  metros_cuadrados: number;
  estado: EstadoPropiedad;
  destacado: boolean;
  imagenes: string[];
  origen_listado: "propio" | "co_broke" | "externo";
  corredor_colaborador_nombre?: string;
  corredor_colaborador_empresa?: string;
  enlace_original?: string;
  formulario_showing_activo?: boolean;
  fecha_showing?: string | Date | null;
  listing_professional?: PublicListingProfessional | null;
};

function formatoPrecio(
  precio: number,
  tipo: TipoNegocio,
  copy: ReturnType<typeof getDictionary>["propertyDetail"]
) {
  if (!Number.isFinite(precio) || precio <= 0) {
    return copy.priceSoon;
  }

  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/${copy.month}`
    : `$${precio.toLocaleString("en-US")}`;
}

function estadoLabel(
  estado: EstadoPropiedad,
  copy: ReturnType<typeof getDictionary>["propertyDetail"]
) {
  return copy.statuses[estado];
}

function estadoClasses(estado: EstadoPropiedad) {
  switch (estado) {
    case "disponible":
      return "bg-[#11518b] text-white";
    case "coming_soon":
      return "bg-[#d4af37] text-black";
    case "bajo_contrato":
      return "bg-[#d4af37] text-black";
    case "vendida":
    case "rentada":
      return "bg-[#4d4d4d] text-white";
    default:
      return "bg-[#cccccc] text-black";
  }
}

function buildAbsoluteImageUrl(imageUrl: string) {
  if (!imageUrl) {
    return "https://borikipr.com/og-image.jpg";
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return `https://borikipr.com${imageUrl}`;
  }

  return `https://borikipr.com/${imageUrl}`;
}

const getLocalizedPropertyDetail = cache(async (slug: string, locale: AppLocale) => {
  const source = (await getPropiedadBySlug(slug)) as unknown as PropiedadDB | null;
  if (!source) return null;
  if (locale !== ENGLISH_LOCALE) {
    return { source, display: source, titlePublishable: true, descriptionPublishable: true };
  }
  const state = await getPropertyTranslationSeoState({ property: source, locale });
  return { source, display: state.property, titlePublishable: state.titlePublishable, descriptionPublishable: state.descriptionPublishable };
});

export async function generateLocalizedPropertyMetadata(
  params: Promise<{ slug: string }>,
  locale: AppLocale
): Promise<Metadata> {
  const { slug } = await params;

  if (!slug) {
    return {
      title: locale === ENGLISH_LOCALE ? "Property not found" : "Propiedad no encontrada",
      description: locale === ENGLISH_LOCALE ? "The requested property is not available." : "La propiedad solicitada no está disponible.",
    };
  }

  const localized = await getLocalizedPropertyDetail(slug, locale);

  if (!localized) {
    return {
      title: locale === ENGLISH_LOCALE ? "Property not found" : "Propiedad no encontrada",
      description: locale === ENGLISH_LOCALE ? "The requested property is not available." : "La propiedad solicitada no está disponible.",
    };
  }

  const { source: row, display } = localized;
  const titulo = display.titulo;
  const locationLabel = formatPropertyLocation(row.municipio, row.sector_comunidad);
  const descripcion = display.descripcion?.trim()
    ? normalizeMetadataDescription(display.descripcion)
    : locale === ENGLISH_LOCALE
      ? `Property in ${locationLabel}.`
      : `Propiedad en ${locationLabel}.`;

  const imagen =
    Array.isArray(row.imagenes) && row.imagenes.length > 0
      ? buildAbsoluteImageUrl(row.imagenes[0])
      : "https://borikipr.com/og-image.jpg";

  const complete = locale !== ENGLISH_LOCALE || isCompleteEnglishPropertyTranslation(localized);
  return buildPropertySeoMetadata({
    locale, slug: row.slug, title: titulo, description: descripcion,
    image: imagen, englishCoverageComplete: complete,
  });
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  return generateLocalizedPropertyMetadata(params, DEFAULT_LOCALE);
}

export async function renderPropertyDetailPage({
  params,
  locale,
}: {
  params: Promise<{ slug: string }>;
  locale: AppLocale;
}) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.propertyDetail;
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  const localized = await getLocalizedPropertyDetail(slug, locale);
  if (!localized) {
    notFound();
  }
  const sourceRow = localized.source;

  const sourceSimilarRows = (await getPropiedadesSimilares(
    sourceRow.slug,
    sourceRow.municipio,
    sourceRow.tipo_negocio,
    sourceRow.tipo_propiedad,
    3
  )) as unknown as PropiedadDB[];
  const similaresRows = await overlayPropertyTranslations({ properties: sourceSimilarRows, locale });
  const row = localized.display;

  const propiedad = {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    descripcion: row.descripcion,
    municipio: row.municipio,
    sectorComunidad: row.sector_comunidad,
    precio: Number(row.precio),
    tipoNegocio: row.tipo_negocio,
    tipoPropiedad: row.tipo_propiedad,
    habitaciones: row.habitaciones,
    banos: row.banos,
    estacionamientos: row.estacionamientos,
    metrosCuadrados: row.metros_cuadrados,
    estado: row.estado,
    destacado: row.destacado,
    imagenes:
      Array.isArray(row.imagenes) && row.imagenes.length > 0
        ? row.imagenes
        : ["/og-image.jpg"],
    origenListado: row.origen_listado,
    corredorColaboradorNombre: row.corredor_colaborador_nombre,
    corredorColaboradorEmpresa: row.corredor_colaborador_empresa,
    enlaceOriginal: row.enlace_original,
    formularioShowingActivo: row.formulario_showing_activo,
    fechaShowing: row.fecha_showing,
    listingProfessional: sourceRow.listing_professional ?? null,
  };

  const propiedadPath =
    getEquivalentRoute(`/listados/${propiedad.slug}`, locale) ??
    `/listados/${propiedad.slug}`;
  const propiedadUrl = `https://borikipr.com${propiedadPath}`;
  const propiedadLocation = formatPropertyLocation(
    propiedad.municipio,
    propiedad.sectorComunidad
  );

  const tipoLinea = propiedad.origenListado === "co_broke"
    ? copy.whatsappCollaboration
    : propiedad.origenListado === "externo"
    ? copy.whatsappExternal
    : "";

  const whatsappMensaje = encodeURIComponent(
    `${copy.whatsappGreeting}

${propiedad.titulo}
${propiedadLocation}
${copy.priceLabel}: ${formatoPrecio(propiedad.precio, propiedad.tipoNegocio, copy)}${tipoLinea ? "\n" + tipoLinea : ""}

${copy.linkLabel}:
${propiedadUrl}`
  );

  const whatsappUrl = `https://wa.me/17876774900?text=${whatsappMensaje}`;
  const professionalWhatsappPhone = propiedad.listingProfessional?.whatsappPhoneE164;
  const professionalWhatsappUrl = professionalWhatsappPhone && /^\+[1-9]\d{7,14}$/.test(professionalWhatsappPhone)
    ? `https://wa.me/${professionalWhatsappPhone.slice(1)}?text=${whatsappMensaje}`
    : null;
  const professionalRoleLabel = propiedad.listingProfessional?.roleId === "real_estate_broker"
    ? copy.listingProfessionalBroker
    : copy.listingProfessionalSalesperson;
  const breadcrumbSchema = breadcrumbJsonLd([
    { name: locale === ENGLISH_LOCALE ? "Home" : "Inicio", url: getEquivalentRoute("/", locale) ?? "/" },
    { name: locale === ENGLISH_LOCALE ? "Listings" : "Listados", url: getEquivalentRoute("/listados", locale) ?? "/listados" },
    { name: propiedad.titulo, url: propiedadPath },
  ]);
  const propertySchema = {
    "@context": "https://schema.org",
    "@type": "Offer",
    name: propiedad.titulo,
    url: propiedadUrl,
    ...(propiedad.precio > 0 ? { price: propiedad.precio } : {}),
    priceCurrency: "USD",
    availability:
      propiedad.estado === "disponible"
        ? "https://schema.org/InStock"
        : "https://schema.org/LimitedAvailability",
    businessFunction:
      propiedad.tipoNegocio === "renta"
        ? "https://schema.org/LeaseOut"
        : "https://schema.org/Sell",
    itemOffered: {
      "@type": "Residence",
      name: propiedad.titulo,
      description: propiedad.descripcion,
      image: propiedad.imagenes.map(buildAbsoluteImageUrl),
      address: {
        "@type": "PostalAddress",
        addressLocality: propiedad.municipio,
        addressRegion: "PR",
        addressCountry: "US",
      },
      numberOfBedrooms: propiedad.habitaciones || undefined,
      numberOfBathroomsTotal: propiedad.banos || undefined,
      floorSize: propiedad.metrosCuadrados
        ? {
            "@type": "QuantitativeValue",
            value: propiedad.metrosCuadrados,
            unitCode: "MTK",
          }
        : undefined,
    },
    seller: {
      "@type": "RealEstateAgent",
      "@id": "https://borikipr.com/#real-estate-agent",
      name: SITE_NAME,
      url: "https://borikipr.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript([breadcrumbSchema, propertySchema])}
      />
      <AnalyticsEventOnView
        eventName="property_view"
        params={{
          property_slug: propiedad.slug,
          status: propiedad.estado,
          tipo_negocio: propiedad.tipoNegocio,
          municipio: propiedad.municipio,
          sector_comunidad: propiedad.sectorComunidad,
        }}
      />
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-16">
          <div className="mb-8">
            <Link
              href={getEquivalentRoute("/listados", locale) ?? "/listados"}
              className="inline-flex items-center gap-2 text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
            >
              ← {copy.backToListings}
            </Link>
          </div>

          <div className="grid gap-12 xl:grid-cols-[1.35fr_1fr] xl:items-start">
            <div className="relative">
              <GaleriaPropiedad
                imagenes={propiedad.imagenes}
                titulo={propiedad.titulo}
              />

              <div className="pointer-events-none absolute left-6 top-6 flex flex-wrap gap-3">
                <span
                  className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] ${estadoClasses(
                    propiedad.estado
                  )}`}
                >
                  {estadoLabel(propiedad.estado, copy)}
                </span>

                {propiedad.destacado && (
                  <span className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#11518b]">
                    {copy.featured}
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="eyebrow">
                {propiedad.tipoNegocio === "venta" ? copy.sale : copy.rent}
              </p>

              <h1 className="mt-4 text-4xl font-bold leading-tight text-[#11518B]">
                {propiedad.titulo}
              </h1>

              <p className="mt-4 text-lg text-[#4d4d4d]">
                {propiedadLocation}
              </p>

              <p className="mt-6 text-3xl font-bold tracking-tight text-[#11518b]">
                {formatoPrecio(propiedad.precio, propiedad.tipoNegocio, copy)}
              </p>

              {propiedad.estado === "bajo_contrato" && (
                <div className="mt-6 rounded-2xl border border-[#d4af37] bg-[#fff9e6] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37]">
                    {copy.underContractTitle}
                  </p>

                  <p className="mt-2 leading-relaxed text-[#4d4d4d]">
                    {copy.underContractDescription}
                  </p>

                  <div className="mt-4">
                    <Link href={getEquivalentRoute("/contact", locale) ?? "/contact"} className="btn-primary px-5 py-2.5">
                      {propiedad.listingProfessional ? copy.contact : copy.talkToIvonne}
                    </Link>
                  </div>
                </div>
              )}

              {propiedad.origenListado === "co_broke" && (
                <div className="mt-6 rounded-2xl border border-[#d4af37] bg-[#fff9e6] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37]">
                    {copy.collaborationTitle}
                  </p>

                  <p className="mt-2 leading-relaxed text-[#4d4d4d]">
                    {propiedad.listingProfessional
                      ? copy.collaborationDescriptionWithProfessional.replace("{name}", propiedad.listingProfessional.displayName)
                      : copy.collaborationDescription}
                  </p>
                </div>
              )}

              {propiedad.origenListado === "externo" && (
                <div className="mt-6 rounded-2xl border border-[#d4af37] bg-[#fff9e6] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37]">
                    {copy.externalTitle}
                  </p>

                  <p className="mt-2 leading-relaxed text-[#4d4d4d]">
                    {copy.externalDescription}
                  </p>
                </div>
              )}

              <div className="mt-8 grid gap-4 rounded-3xl border border-[#e8e8e8] bg-white p-6 text-sm text-[#4d4d4d] shadow-sm sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#000000]">{copy.facts.type}</p>
                  <p className="mt-1">{dictionary.listingsPage.propertyTypes[propiedad.tipoPropiedad]}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">{copy.facts.status}</p>
                  <p className="mt-1">{estadoLabel(propiedad.estado, copy)}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">{copy.facts.bedrooms}</p>
                  <p className="mt-1">{propiedad.habitaciones}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">{copy.facts.bathrooms}</p>
                  <p className="mt-1">{propiedad.banos}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">
                    {copy.facts.parking}
                  </p>
                  <p className="mt-1">{propiedad.estacionamientos}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">
                    {copy.facts.squareMeters}
                  </p>
                  <p className="mt-1">{propiedad.metrosCuadrados}</p>
                </div>
              </div>

              <div className="mt-8 xl:sticky xl:top-[108px]">
                <div className="rounded-3xl border border-[#e8e8e8] bg-[#f8f8f8] p-6 shadow-sm">
                  {propiedad.listingProfessional && (
                    <ListingProfessionalCard
                      professional={propiedad.listingProfessional}
                      sectionLabel={copy.listingProfessionalSection}
                      roleLabel={professionalRoleLabel}
                      licenseLabel={copy.licenseLabel}
                      photoAlt={copy.professionalPhotoAlt.replace("{name}", propiedad.listingProfessional.displayName)}
                    />
                  )}

                  <p className={`${propiedad.listingProfessional ? "mt-5 " : ""}text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]`}>
                    {copy.interestEyebrow}
                  </p>

                  <p className="mt-3 text-[#4d4d4d]">
                    {propiedad.listingProfessional
                      ? copy.interestDescriptionWithProfessional.replace("{name}", propiedad.listingProfessional.displayName)
                      : copy.interestDescription}
                  </p>

                  {(!propiedad.listingProfessional || professionalWhatsappUrl) && (
                    <p className="mt-4 text-sm text-[#4d4d4d]">
                      {copy.quickResponse}
                    </p>
                  )}

                  <div className="mt-6 space-y-3">
                    {propiedad.estado === "coming_soon" && (
                      <AnalyticsLink
                        href={getEquivalentRoute(`/properties/${propiedad.slug}/registro-prioritario`, locale) ?? `/properties/${propiedad.slug}/registro-prioritario`}
                        eventName="priority_registration_cta_click"
                        eventParams={{
                          property_slug: propiedad.slug,
                          status: propiedad.estado,
                        }}
                        className="inline-flex w-full items-center justify-center rounded-full bg-[#d4af37] px-6 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#c19d2f]"
                      >
                        {copy.priorityRegistration}
                      </AnalyticsLink>
                    )}

                    <TrackLinkButton
                      href={getEquivalentRoute("/contact", locale) ?? "/contact"}
                      slug={propiedad.slug}
                      tipo="contact_click"
                      analyticsEventName="property_contact_click"
                      analyticsParams={{
                        property_slug: propiedad.slug,
                        cta_location: propiedad.listingProfessional ? "listing_professional_card" : "property_detail",
                      }}
                      ariaLabel={propiedad.listingProfessional
                        ? copy.contactAccessible.replace("{property}", propiedad.titulo)
                        : undefined}
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#11518b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0d406d]"
                    >
                      {propiedad.listingProfessional ? copy.contact : copy.requestInformation}
                    </TrackLinkButton>

                    {(professionalWhatsappUrl || !propiedad.listingProfessional) && (
                      <WhatsAppTrackerButton
                        url={professionalWhatsappUrl ?? whatsappUrl}
                        slug={propiedad.slug}
                        ctaLocation={propiedad.listingProfessional ? "listing_professional_card" : "property_detail"}
                        ariaLabel={propiedad.listingProfessional
                          ? copy.whatsappAccessible
                              .replace("{name}", propiedad.listingProfessional.displayName)
                              .replace("{property}", propiedad.titulo)
                          : undefined}
                        className="inline-flex w-full items-center justify-center rounded-full border border-[#25D366] px-6 py-3 text-sm font-semibold text-[#137a3b] transition hover:bg-[#25D366] hover:text-[#0d1b2a]"
                      >
                        {copy.whatsapp}
                      </WhatsAppTrackerButton>
                    )}

                    {propiedad.estado === "disponible" && (
                      <Link
                        href={getEquivalentRoute(`/listados/${propiedad.slug}/perfil-comprador`, locale) ?? `/listados/${propiedad.slug}/perfil-comprador`}
                        className="inline-flex w-full items-center justify-center rounded-full border border-[#11518b] px-6 py-3 text-sm font-semibold text-[#11518b] transition hover:bg-[#11518b] hover:text-white"
                      >
                        {copy.buyerProfile}
                      </Link>
                    )}

                    {propiedad.formularioShowingActivo && propiedad.fechaShowing && (
                      <AnalyticsLink
                        href={getEquivalentRoute(`/listados/${propiedad.slug}/registro-openhouse`, locale) ?? `/listados/${propiedad.slug}/registro-openhouse`}
                        eventName="showing_profile_cta_click"
                        eventParams={{ property_slug: propiedad.slug }}
                        className="inline-flex w-full items-center justify-center rounded-full border border-[#d4af37] px-6 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#d4af37]"
                      >
                        {copy.openHouse}
                      </AnalyticsLink>
                    )}
                  </div>
                  <div className="mt-6 border-t border-[#dddddd] pt-6 text-sm text-[#4d4d4d]">
                    <p className="font-semibold text-[#000000]">
                      {copy.personalAttentionTitle}
                    </p>
                    <p className="mt-2 leading-relaxed">
                      {copy.personalAttentionDescription}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="pb-24">
          <div className="section-shell">
            <div className="max-w-4xl">
              <p className="eyebrow">{copy.descriptionEyebrow}</p>

              <h2 className="mt-4 text-3xl font-bold text-[#11518B]">
                {copy.descriptionTitle}
              </h2>

              <p className="mt-6 whitespace-pre-line text-lg leading-relaxed text-[#4d4d4d]">
                {propiedad.descripcion}
              </p>
            </div>
          </div>
        </section>

        {similaresRows.length > 0 && (
          <section className="pb-24">
            <div className="section-shell">
              <div className="mb-10">
                <p className="eyebrow">{copy.similarEyebrow}</p>

                <h2 className="mt-4 text-3xl font-bold text-[#000000]">
                  {copy.similarTitle}
                </h2>

                <p className="mt-4 max-w-2xl text-[#4d4d4d]">
                  {copy.similarDescription}
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2 2xl:grid-cols-3">
                {similaresRows.map((item) => {
                  const precio = Number(item.precio);
                  const imagenPrincipal =
                    Array.isArray(item.imagenes) && item.imagenes.length > 0
                      ? item.imagenes[0]
                      : "/og-image.jpg";

                  return (
                    <article
                      key={item.id}
                      className="group overflow-hidden rounded-3xl border border-[#e8e8e8] bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
                    >
                      <div className="relative h-72 w-full bg-[#f5f5f5]">
                        <Image
                          src={imagenPrincipal}
                          alt={item.titulo}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
                          className="object-cover transition-transform duration-500 group-hover:scale-105"
                        />

                        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                          <span
                            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] ${estadoClasses(
                              item.estado
                            )}`}
                          >
                            {estadoLabel(item.estado, copy)}
                          </span>

                          {item.destacado && (
                            <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#11518b]">
                              {copy.featured}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-8">
                        <div className="mb-4 flex justify-between gap-4">
                          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                            {item.tipo_negocio === "venta" ? copy.sale : copy.rent}
                          </span>

                          <span className="text-sm text-[#4d4d4d]">
                            {formatPropertyLocation(
                              item.municipio,
                              item.sector_comunidad
                            )}
                          </span>
                        </div>

                        <h3 className="text-xl font-semibold text-[#11518b]">
                          {item.titulo}
                        </h3>

                        <p className="mt-4 text-2xl font-bold tracking-tight text-[#000000]">
                          {formatoPrecio(precio, item.tipo_negocio, copy)}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#4d4d4d]">
                          <span>{dictionary.listingsPage.propertyTypes[item.tipo_propiedad]}</span>
                          {item.habitaciones > 0 && (
                            <span>{item.habitaciones} {copy.bedroomShort}</span>
                          )}
                          {item.banos > 0 && <span>{item.banos} {copy.bathroomShort}</span>}
                        </div>

                        <div className="mt-6">
                          <Link
                            href={getEquivalentRoute(`/listados/${item.slug}`, locale) ?? `/listados/${item.slug}`}
                            className="inline-flex items-center justify-center rounded-full border border-[#11518b] px-5 py-2.5 text-sm font-semibold text-[#11518b] transition-all duration-300 hover:bg-[#11518b] hover:text-white"
                          >
                            {copy.viewDetails}
                          </Link>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}

export default function DetallePropiedadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  return renderPropertyDetailPage({ params, locale: DEFAULT_LOCALE });
}
