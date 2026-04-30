import Header from "@/components/Header";
import Image from "next/image";
import Link from "next/link";
import GaleriaPropiedad from "@/components/GaleriaPropiedad";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPropiedadBySlug,
  getPropiedadesSimilares,
} from "@/lib/queries/propiedades";
import { TipoPropiedad } from "@/data/listados";
import WhatsAppTrackerButton from "@/components/WhatsAppTrackerButton";
import TrackLinkButton from "@/components/TrackLinkButton";

type TipoNegocio = "venta" | "renta";
type EstadoPropiedad =
  | "disponible"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

type PropiedadDB = {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
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
};

function formatoPrecio(precio: number, tipo: TipoNegocio) {
  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/mes`
    : `$${precio.toLocaleString("en-US")}`;
}

function estadoLabel(estado: EstadoPropiedad) {
  switch (estado) {
    case "disponible":
      return "Disponible";
    case "bajo_contrato":
      return "Bajo contrato";
    case "vendida":
      return "Vendida";
    case "rentada":
      return "Alquilada";
    default:
      return estado;
  }
}

function estadoClasses(estado: EstadoPropiedad) {
  switch (estado) {
    case "disponible":
      return "bg-[#11518b] text-white";
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
    return "https://borikipr.com/placeholder.jpg";
  }

  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    return imageUrl;
  }

  if (imageUrl.startsWith("/")) {
    return `https://borikipr.com${imageUrl}`;
  }

  return `https://borikipr.com/${imageUrl}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;

  if (!slug) {
    return {
      title: "Propiedad no encontrada | Borikí",
      description: "La propiedad solicitada no está disponible.",
    };
  }

  const row = (await getPropiedadBySlug(slug)) as unknown as PropiedadDB | null;

  if (!row) {
    return {
      title: "Propiedad no encontrada | Borikí",
      description: "La propiedad solicitada no está disponible.",
    };
  }

  const titulo = `${row.titulo} | Borikí`;
  const descripcion = row.descripcion?.trim()
    ? row.descripcion.trim().slice(0, 160)
    : `Propiedad en ${row.municipio}, Puerto Rico.`;

  const imagen =
    Array.isArray(row.imagenes) && row.imagenes.length > 0
      ? buildAbsoluteImageUrl(row.imagenes[0])
      : "https://borikipr.com/placeholder.jpg";

  const url = `https://borikipr.com/listados/${row.slug}`;

  return {
    title: titulo,
    description: descripcion,
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: titulo,
      description: descripcion,
      url,
      siteName: "Borikí",
      type: "article",
      images: [
        {
          url: imagen,
          width: 1200,
          height: 630,
          alt: row.titulo,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
      images: [imagen],
    },
  };
}

export default async function DetallePropiedadPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!slug) {
    notFound();
  }

  const row = (await getPropiedadBySlug(slug)) as unknown as PropiedadDB | null;

  if (!row) {
    notFound();
  }

  const similaresRows = (await getPropiedadesSimilares(
    row.slug,
    row.municipio,
    row.tipo_negocio,
    row.tipo_propiedad,
    3
  )) as unknown as PropiedadDB[];

  const propiedad = {
    id: row.id,
    slug: row.slug,
    titulo: row.titulo,
    descripcion: row.descripcion,
    municipio: row.municipio,
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
        : ["/placeholder.jpg"],
    origenListado: row.origen_listado,
    corredorColaboradorNombre: row.corredor_colaborador_nombre,
    corredorColaboradorEmpresa: row.corredor_colaborador_empresa,
    enlaceOriginal: row.enlace_original,
  };

  const propiedadUrl = `https://borikipr.com/listados/${propiedad.slug}`;

  const tipoLinea = propiedad.origenListado === "co_broke"
    ? "Tipo: Propiedad en colaboración"
    : propiedad.origenListado === "externo"
    ? "Tipo: Propiedad de referencia"
    : "";

  const whatsappMensaje = encodeURIComponent(
    `Hola, me interesa esta propiedad:

${propiedad.titulo}
${propiedad.municipio}, Puerto Rico
Precio: ${formatoPrecio(propiedad.precio, propiedad.tipoNegocio)}${tipoLinea ? "\n" + tipoLinea : ""}

Link:
${propiedadUrl}`
  );

  const whatsappUrl = `https://wa.me/17876774900?text=${whatsappMensaje}`;

  return (
    <>
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-16">
          <div className="mb-8">
            <Link
              href="/listados"
              className="inline-flex items-center gap-2 text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
            >
              ← Volver a listados
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
                  {estadoLabel(propiedad.estado)}
                </span>

                {propiedad.destacado && (
                  <span className="rounded-full bg-white/90 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#11518b]">
                    Destacado
                  </span>
                )}
              </div>
            </div>

            <div>
              <p className="eyebrow">
                {propiedad.tipoNegocio === "venta" ? "Venta" : "Alquiler"}
              </p>

              <h1 className="mt-4 text-4xl font-bold leading-tight text-[#000000]">
                {propiedad.titulo}
              </h1>

              <p className="mt-4 text-lg text-[#4d4d4d]">
                {propiedad.municipio}, Puerto Rico
              </p>

              <p className="mt-6 text-3xl font-bold tracking-tight text-[#11518b]">
                {formatoPrecio(propiedad.precio, propiedad.tipoNegocio)}
              </p>

              {propiedad.estado === "bajo_contrato" && (
                <div className="mt-6 rounded-2xl border border-[#d4af37] bg-[#fff9e6] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37]">
                    Bajo contrato
                  </p>

                  <p className="mt-2 leading-relaxed text-[#4d4d4d]">
                    Esta propiedad se encuentra actualmente bajo contrato. Aun
                    así, podemos orientarte sobre esta oportunidad y mostrarte
                    opciones similares que encajen con lo que buscas.
                  </p>

                  <div className="mt-4">
                    <Link href="/contact" className="btn-primary px-5 py-2.5">
                      Hablar con Ivonne
                    </Link>
                  </div>
                </div>
              )}

              {propiedad.origenListado === "co_broke" && (
                <div className="mt-6 rounded-2xl border border-[#d4af37] bg-[#fff9e6] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37]">
                    Propiedad en colaboración
                  </p>

                  <p className="mt-2 leading-relaxed text-[#4d4d4d]">
                    Esta propiedad se presenta en colaboración con otro profesional de bienes raíces. Ivonne Erickson puede asistirle en la orientación, coordinación de información y proceso de representación, sujeto a disponibilidad y acuerdo entre las partes.
                  </p>
                </div>
              )}

              {propiedad.origenListado === "externo" && (
                <div className="mt-6 rounded-2xl border border-[#d4af37] bg-[#fff9e6] p-6">
                  <p className="text-sm font-semibold uppercase tracking-[0.15em] text-[#d4af37]">
                    Propiedad de referencia
                  </p>

                  <p className="mt-2 leading-relaxed text-[#4d4d4d]">
                    Esta propiedad puede provenir de una fuente externa o colaboración profesional. La información está sujeta a confirmación de disponibilidad.
                  </p>
                </div>
              )}

              <div className="mt-8 grid gap-4 rounded-3xl border border-[#e8e8e8] bg-white p-6 text-sm text-[#4d4d4d] shadow-sm sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-[#000000]">Tipo</p>
                  <p className="mt-1">{propiedad.tipoPropiedad}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">Estado</p>
                  <p className="mt-1">{estadoLabel(propiedad.estado)}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">Habitaciones</p>
                  <p className="mt-1">{propiedad.habitaciones}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">Baños</p>
                  <p className="mt-1">{propiedad.banos}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">
                    Estacionamientos
                  </p>
                  <p className="mt-1">{propiedad.estacionamientos}</p>
                </div>

                <div>
                  <p className="font-semibold text-[#000000]">
                    Metros cuadrados
                  </p>
                  <p className="mt-1">{propiedad.metrosCuadrados}</p>
                </div>
              </div>

              <div className="mt-8 xl:sticky xl:top-[108px]">
                <div className="rounded-3xl border border-[#e8e8e8] bg-[#f8f8f8] p-6 shadow-sm">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                    ¿Te interesa esta propiedad?
                  </p>

                  <p className="mt-3 text-[#4d4d4d]">
                    Solicita más información, coordina una visita o aclara tus
                    dudas directamente con Ivonne.
                  </p>

                  <p className="mt-4 text-sm text-[#4d4d4d]">
                    Respuesta rápida por WhatsApp.
                  </p>

                  <div className="mt-6 space-y-3">
                    <TrackLinkButton
                      href="/contact"
                      slug={propiedad.slug}
                      tipo="contact_click"
                      className="inline-flex w-full items-center justify-center rounded-full bg-[#11518b] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0d406d]"
                    >
                      Solicitar información
                    </TrackLinkButton>

                    <WhatsAppTrackerButton
                      url={whatsappUrl}
                      slug={propiedad.slug}
                      className="inline-flex w-full items-center justify-center rounded-full border border-[#25D366] px-6 py-3 text-sm font-semibold text-[#25D366] transition hover:bg-[#25D366] hover:text-white"
                    >
                      Escribir por WhatsApp
                    </WhatsAppTrackerButton>
                  </div>
                  <div className="mt-6 border-t border-[#dddddd] pt-6 text-sm text-[#4d4d4d]">
                    <p className="font-semibold text-[#000000]">
                      Atención personalizada
                    </p>
                    <p className="mt-2 leading-relaxed">
                      Recibe orientación clara sobre esta propiedad y opciones
                      similares en Puerto Rico.
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
              <p className="eyebrow">Descripción</p>

              <h2 className="mt-4 text-3xl font-bold text-[#000000]">
                Detalles de la propiedad
              </h2>

              <p className="mt-6 text-lg leading-relaxed text-[#4d4d4d]">
                {propiedad.descripcion}
              </p>
            </div>
          </div>
        </section>

        {similaresRows.length > 0 && (
          <section className="pb-24">
            <div className="section-shell">
              <div className="mb-10">
                <p className="eyebrow">Opciones similares</p>

                <h2 className="mt-4 text-3xl font-bold text-[#000000]">
                  Otras propiedades que podrían interesarte
                </h2>

                <p className="mt-4 max-w-2xl text-[#4d4d4d]">
                  Explora alternativas con características similares en Puerto
                  Rico.
                </p>
              </div>

              <div className="grid gap-8 md:grid-cols-2 2xl:grid-cols-3">
                {similaresRows.map((item) => {
                  const precio = Number(item.precio);
                  const imagenPrincipal =
                    Array.isArray(item.imagenes) && item.imagenes.length > 0
                      ? item.imagenes[0]
                      : "/placeholder.jpg";

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
                            {estadoLabel(item.estado)}
                          </span>

                          {item.destacado && (
                            <span className="rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-[#11518b]">
                              Destacado
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="p-8">
                        <div className="mb-4 flex justify-between gap-4">
                          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
                            {item.tipo_negocio === "venta" ? "Venta" : "Alquiler"}
                          </span>

                          <span className="text-sm text-[#4d4d4d]">
                            {item.municipio}
                          </span>
                        </div>

                        <h3 className="text-xl font-semibold text-[#11518b]">
                          {item.titulo}
                        </h3>

                        <p className="mt-4 text-2xl font-bold tracking-tight text-[#000000]">
                          {formatoPrecio(precio, item.tipo_negocio)}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#4d4d4d]">
                          <span>{item.tipo_propiedad}</span>
                          {item.habitaciones > 0 && (
                            <span>{item.habitaciones} hab.</span>
                          )}
                          {item.banos > 0 && <span>{item.banos} baños</span>}
                        </div>

                        <div className="mt-6">
                          <Link
                            href={`/listados/${item.slug}`}
                            className="inline-flex items-center justify-center rounded-full border border-[#11518b] px-5 py-2.5 text-sm font-semibold text-[#11518b] transition-all duration-300 hover:bg-[#11518b] hover:text-white"
                          >
                            Ver detalles
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