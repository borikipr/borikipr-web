import type { Metadata } from "next";
import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import HomeHeroClient from "@/components/HomeHeroClient";
import {
  Building2,
  Camera,
  HeartHandshake,
  Mountain,
  Sun,
  Sunset,
  Trees,
  TrendingUp,
  UserCheck,
  Waves,
} from "lucide-react";
import { getRegionByName } from "@/data/zonas";
import {
  getPropiedades,
  getPropiedadesDestacadas,
  type PropiedadHomeDestacada,
} from "@/lib/queries/propiedades";
import { getTestimoniosPublicos, type TestimonioPublico } from "@/lib/queries/testimonios";
import { formatPropertyLocation } from "@/lib/puerto-rico-sectores";
import { DEFAULT_OG_IMAGE, SITE_NAME, SITE_URL } from "@/lib/seo";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/locales";
import { getEquivalentRoute } from "@/lib/i18n/routing";

const pageTitle = "Bienes Raíces en Puerto Rico";
const pageDescription =
  "Compra, vende o invierte en Puerto Rico con orientación clara, estrategia y acompañamiento profesional.";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: `${SITE_NAME} | ${pageTitle}`,
    description: pageDescription,
    url: SITE_URL,
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | ${pageTitle}`,
    description: pageDescription,
    images: [DEFAULT_OG_IMAGE],
  },
};

type TipoNegocio = "venta" | "renta";
type EstadoPropiedad =
  | "disponible"
  | "coming_soon"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

function formatoPrecio(precio: number, tipo: TipoNegocio, priceSoon: string) {
  if (!Number.isFinite(precio) || precio <= 0) {
    return priceSoon;
  }

  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/mes`
    : `$${precio.toLocaleString("en-US")}`;
}

function estadoLabel(
  estado: EstadoPropiedad,
  statuses: ReturnType<typeof getDictionary>["home"]["listings"]["statuses"]
) {
  switch (estado) {
    case "disponible":
      return statuses.available;
    case "coming_soon":
      return statuses.comingSoon;
    case "bajo_contrato":
      return statuses.underContract;
    case "vendida":
      return statuses.sold;
    case "rentada":
      return statuses.rented;
    default:
      return estado;
  }
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

const zonasHome = [
  {
    nombre: "Metropolitana",
    Icon: Building2,
  },
  {
    nombre: "Norte",
    Icon: Waves,
  },
  {
    nombre: "Sur",
    Icon: Sun,
  },
  {
    nombre: "Este",
    Icon: Trees,
  },
  {
    nombre: "Oeste",
    Icon: Sunset,
  },
  {
    nombre: "Central",
    Icon: Mountain,
  },
];

export async function renderHomePage(locale: AppLocale) {
  const dictionary = getDictionary(locale);
  const copy = dictionary.home;
  const listingsHref =
    getEquivalentRoute("/listados", locale) ?? "/listados";
  const contactHref = getEquivalentRoute("/contact", locale) ?? "/contact";
  const testimonialsHref =
    getEquivalentRoute("/testimonios", locale) ?? "/testimonios";
  const aboutHref = getEquivalentRoute("/about", locale) ?? "/about";
  let rows: { id: string }[] = [];
  let destacadas: PropiedadHomeDestacada[] = [];
  let allTestimonios: TestimonioPublico[] = [];

  try {
    rows = (await getPropiedades()) as unknown as { id: string }[];
  } catch (error) {
    console.warn("HOME WARNING: no se pudo cargar el total de propiedades.", error);
  }

  try {
    destacadas = await getPropiedadesDestacadas(3);
  } catch (error) {
    console.warn("HOME WARNING: no se pudieron cargar propiedades destacadas.", error);
  }

  try {
    allTestimonios = await getTestimoniosPublicos();
  } catch (error) {
    console.warn("HOME WARNING: no se pudieron cargar testimonios.", error);
  }

  const totalPropiedades = rows.length;

  const testimoniosDestacados = allTestimonios
    .filter((t) => t.destacado)
    .slice(0, 3);
  const testimoniosHome =
    testimoniosDestacados.length > 0
      ? testimoniosDestacados
      : allTestimonios.slice(0, 3);

  return (
    <>
      <Header transparent />

      <main className="bg-white">
        <HomeHeroClient totalPropiedades={totalPropiedades} />

        {/* Sección: Por qué elegir a Ivonne */}
        <section className="bg-white py-24">
          <div className="section-shell">
            <div className="text-center max-w-3xl mx-auto">
              <p className="eyebrow">{copy.reasons.eyebrow}</p>

              <h2 className="heading-section mt-4 !text-[#11518B]">
                {copy.reasons.title}
              </h2>

              <p className="body-lg mt-6">
                {copy.reasons.description}
              </p>
            </div>

            <div className="mt-14 grid gap-8 md:grid-cols-4">
              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#11518B]">
                  <UserCheck className="h-7 w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  {copy.reasons.items[0].title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  {copy.reasons.items[0].description}
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#11518B]">
                  <TrendingUp className="h-7 w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  {copy.reasons.items[1].title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  {copy.reasons.items[1].description}
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#11518B]">
                  <Camera className="h-7 w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  {copy.reasons.items[2].title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  {copy.reasons.items[2].description}
                </p>
              </div>

              <div className="text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#11518B]">
                  <HeartHandshake className="h-7 w-7 text-white" strokeWidth={1.9} aria-hidden="true" />
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#000000]">
                  {copy.reasons.items[3].title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#4d4d4d]">
                  {copy.reasons.items[3].description}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Sección: Propiedades destacadas */}
        <section className="bg-[#f8f8f8] py-20">
          <div className="section-shell">
            <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-3xl">
                <p className="eyebrow">{copy.listings.eyebrow}</p>

                <h2 className="heading-section mt-4 !text-[#11518B]">
                  {copy.listings.title}
                </h2>

                <p className="body-lg mt-5 max-w-2xl">
                  {copy.listings.description}
                </p>
              </div>

              <div>
                <Link href={listingsHref} className="btn-secondary">
                  {dictionary.common.viewListings}
                </Link>
              </div>
            </div>

            <div className="mt-10">
              {destacadas.length === 0 ? (
                <div className="mx-auto max-w-4xl rounded-2xl border border-[#e8e8e8] bg-white p-8 text-center shadow-sm sm:p-10">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                    {copy.listings.comingSoon}
                  </p>
                  <h3 className="mt-3 text-2xl font-bold text-[#000000]">
                    {copy.listings.emptyTitle}
                  </h3>
                  <p className="mt-3 max-w-lg mx-auto text-[#4d4d4d] leading-relaxed">
                    {copy.listings.emptyDescription}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-4 justify-center">
                    <Link href={listingsHref} className="btn-primary">
                      {dictionary.common.viewListings}
                    </Link>
                    <Link href={contactHref} className="btn-secondary">
                      {dictionary.common.contactIvonne}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="grid gap-8 md:grid-cols-2 2xl:grid-cols-3">
                  {destacadas.map((item) => {
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
                            sizes="(max-width: 768px) 100vw, (max-width: 1536px) 50vw, 33vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />

                          <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                            <span
                              className={`rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] ${estadoClasses(
                                item.estado
                              )}`}
                            >
                              {estadoLabel(item.estado, copy.listings.statuses)}
                            </span>

                            {item.destacado && (
                              <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#11518b]">
                                {copy.listings.featured}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="p-8">
                          <div className="mb-4 flex justify-between gap-4">
                            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                              {item.tipo_negocio === "venta"
                                ? copy.listings.sale
                                : copy.listings.rent}
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
                            {formatoPrecio(
                              Number(item.precio),
                              item.tipo_negocio,
                              copy.listings.priceSoon
                            )}
                          </p>

                          <div className="mt-4 flex flex-wrap gap-3 text-sm text-[#4d4d4d]">
                            {item.habitaciones && (
                              <span>
                                {item.habitaciones} {copy.listings.bedroomsShort}
                              </span>
                            )}
                            {item.banos && (
                              <span>
                                {item.banos} {copy.listings.bathroomsShort}
                              </span>
                            )}
                            <span>{item.tipo_propiedad}</span>
                          </div>

                          <div className="mt-6">
                            <Link
                              href={`/listados/${item.slug}`}
                              className="inline-flex items-center justify-center rounded-full border border-[#11518b] px-5 py-2.5 text-sm font-semibold text-[#11518b] transition-all duration-300 hover:bg-[#11518b] hover:text-white"
                            >
                              {dictionary.common.viewProperty}
                            </Link>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sección: Zonas de Puerto Rico */}
        <section className="bg-[#f8f8f8] py-24">
          <div className="section-shell">
            <div className="text-center max-w-3xl mx-auto">
              <p className="eyebrow">{copy.regions.eyebrow}</p>

              <h2 className="heading-section mt-4 !text-[#11518B]">
                {copy.regions.title}
              </h2>

              <p className="body-lg mt-6">
                {copy.regions.description}
              </p>
            </div>

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {zonasHome.map((zona, index) => (
                <Link
                  key={zona.nombre}
                  href={`${listingsHref}?region=${
                    getRegionByName(zona.nombre) ?? ""
                  }`}
                  className="group rounded-2xl border border-[#e8e8e8] bg-white p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-[#11518b]/30"
                >
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-[#11518B]">
                      <zona.Icon className="h-6 w-6 text-white" strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <div>
                      <h3 className="text-lg font-semibold text-[#11518b] group-hover:text-[#0d3a63] transition">
                        {zona.nombre}
                      </h3>
                      <p className="mt-1 text-sm text-[#4d4d4d]">
                        {copy.regions.descriptions[index]}
                      </p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Sección: Testimonios */}
        {testimoniosHome.length > 0 && (
          <section className="bg-white py-24">
            <div className="section-shell">
              <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="max-w-3xl">
                  <p className="eyebrow">{copy.testimonials.eyebrow}</p>

                  <h2 className="heading-section mt-4 !text-[#11518B]">
                    {copy.testimonials.title}
                  </h2>

                  <p className="body-lg mt-6 max-w-2xl">
                    {copy.testimonials.description}
                  </p>
                </div>

                <div>
                  <Link href={testimonialsHref} className="btn-secondary">
                    {copy.testimonials.viewAll}
                  </Link>
                </div>
              </div>

              <div className="mt-14 grid gap-8 md:grid-cols-3">
                {testimoniosHome.map((testimonio) => (
                  <article
                    key={testimonio.id}
                    className="rounded-2xl border border-[#e8e8e8] bg-white p-8 shadow-sm transition-all duration-300 hover:shadow-lg"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      {testimonio.imagen && testimonio.imagen !== "/og-image.jpg" ? (
                        <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full">
                          <Image
                            src={testimonio.imagen}
                            alt={testimonio.nombre}
                            fill
                            sizes="56px"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#11518b]/10">
                          <span className="text-xl font-bold text-[#11518b]">
                            {testimonio.nombre.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-[#000000]">
                          {testimonio.nombre}
                        </p>
                        <p className="text-sm text-[#4d4d4d]">
                          {testimonio.lugar}
                        </p>
                      </div>
                    </div>

                    <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37] mb-3">
                      {testimonio.tipo === "comprador"
                        ? copy.testimonials.buyer
                        : copy.testimonials.seller}
                    </p>

                    <p className="text-[#4d4d4d] leading-relaxed line-clamp-4">
                      &ldquo;{testimonio.texto}&rdquo;
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Sección: CTA */}
        <section className="bg-[#11518b] py-24">
          <div className="section-shell">
            <div className="rounded-[2rem] border border-white/10 bg-white/10 p-10 text-white shadow-xl backdrop-blur-sm md:p-14">
              <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
                <div className="max-w-3xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[#d4af37]">
                    {copy.cta.eyebrow}
                  </p>

                  <h2 className="mt-4 text-4xl font-bold leading-tight md:text-5xl">
                    {copy.cta.title}
                  </h2>

                  <p className="mt-6 text-lg leading-relaxed text-white/85">
                    {copy.cta.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Link href={contactHref} className="btn-gold">
                    {copy.cta.requestGuidance}
                  </Link>

                  <Link
                    href={aboutHref}
                    className="inline-flex items-center justify-center rounded-full border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    {copy.cta.meetIvonne}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

export default function Home() {
  return renderHomePage(DEFAULT_LOCALE);
}
