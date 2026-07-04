import type { Metadata } from "next";
import { Suspense } from "react";
import Header from "@/components/Header";
import ListadosClient from "@/components/ListadosClient";
import PropiedadSkeleton from "@/components/PropiedadSkeleton";
import { getPropiedadesPaginadas } from "@/lib/queries/propiedades";
import {
  DEFAULT_OG_IMAGE,
  SITE_NAME,
  absoluteUrl,
  breadcrumbJsonLd,
  jsonLdScript,
} from "@/lib/seo";

const pageTitle = "Listados de Propiedades";
const pageDescription =
  "Explora propiedades en venta y alquiler en Puerto Rico con información clara, filtros útiles y orientación profesional.";
const pagePath = "/listados";

export const metadata: Metadata = {
  title: pageTitle,
  description: pageDescription,
  alternates: {
    canonical: pagePath,
  },
  openGraph: {
    title: pageTitle,
    description: pageDescription,
    url: absoluteUrl(pagePath),
    siteName: SITE_NAME,
    type: "website",
    images: [{ url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: pageTitle,
    description: pageDescription,
    images: [DEFAULT_OG_IMAGE],
  },
};

type TipoPropiedad =
  | "Casa"
  | "Apartamento"
  | "Condominio"
  | "Terreno"
  | "Comercial";



type SearchParams = Promise<{
  municipio?: string;
  tipoNegocio?: string;
  tipoPropiedad?: string;
  precioMin?: string;
  precioMax?: string;
  habitaciones?: string;
  banos?: string;
  orden?: string;
  estado?: string;
  q?: string;
  page?: string;
}>;

export default async function ListadosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requestedPage = parseInt(params.page || "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;

  // Parse tipoPropiedad as array
  const tiposPropiedadValidos: TipoPropiedad[] = [
    "Casa",
    "Apartamento",
    "Condominio",
    "Terreno",
    "Comercial",
  ];
  const tipoPropiedad = params.tipoPropiedad
    ? params.tipoPropiedad
        .split(",")
        .filter((tipo) => tiposPropiedadValidos.includes(tipo as TipoPropiedad))
    : [];

  const data = await getPropiedadesPaginadas(page, 12, {
    q: params.q ?? "",
    municipio: params.municipio ?? "",
    tipoNegocio:
      params.tipoNegocio === "venta" || params.tipoNegocio === "renta"
        ? params.tipoNegocio
        : "",
    tipoPropiedad,
    precioMin: params.precioMin ?? "",
    precioMax: params.precioMax ?? "",
    habitaciones: params.habitaciones ?? "",
    banos: params.banos ?? "",
    estado:
      params.estado === "disponible" ||
      params.estado === "coming_soon" ||
      params.estado === "bajo_contrato" ||
      params.estado === "vendida" ||
      params.estado === "rentada"
        ? params.estado
        : "",
    orden:
      params.orden === "precio-asc" ||
      params.orden === "precio-desc" ||
      params.orden === "municipio-asc" ||
      params.orden === "municipio-desc"
        ? params.orden
        : "",
  });

  const propiedades = data.propiedades.map((p) => ({
    id: p.id,
    slug: p.slug,
    titulo: p.titulo,
    descripcion: p.descripcion,
    municipio: p.municipio,
    precio: Number(p.precio),
    tipo_negocio: p.tipo_negocio,
    tipo_propiedad: p.tipo_propiedad as TipoPropiedad,
    habitaciones: p.habitaciones,
    banos: p.banos,
    estacionamientos: p.estacionamientos,
    metros_cuadrados: p.metros_cuadrados,
    estado: p.estado,
    destacado: p.destacado,
    imagenes:
      Array.isArray(p.imagenes) && p.imagenes.length > 0
        ? p.imagenes
        : ["/og-image.jpg"],
    origen_listado: p.origen_listado,
  }));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLdScript(
          breadcrumbJsonLd([
            { name: "Inicio", url: "/" },
            { name: "Listados", url: pagePath },
          ])
        )}
      />
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Listados</p>

            <h1 className="heading-section heading-section-blue mt-4">
            Propiedades en venta y alquiler
            </h1>

            <p className="body-lg mt-6">
              Explora propiedades por municipio, rango de precio y tipo para
              encontrar opciones alineadas con tus objetivos.
            </p>
          </div>
        </section>

        <Suspense
          fallback={
            <section className="pb-24">
              <div className="section-shell">
                <div className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <PropiedadSkeleton key={i} />
                  ))}
                </div>
              </div>
            </section>
          }
        >
          <ListadosClient
            propiedades={propiedades}
            paginationData={{
              currentPage: data.currentPage,
              totalPages: data.totalPages,
              totalItems: data.totalItems,
            }}
            initialFilters={{
              q: params.q ?? "",
              municipio: params.municipio ?? "",
              tipoNegocio:
                params.tipoNegocio === "venta" || params.tipoNegocio === "renta"
                  ? params.tipoNegocio
                  : "",
              tipoPropiedad: tipoPropiedad as TipoPropiedad[],
              precioMin: params.precioMin ?? "",
              precioMax: params.precioMax ?? "",
              habitaciones: params.habitaciones ?? "",
              banos: params.banos ?? "",
              orden:
                params.orden === "precio-asc" ||
                params.orden === "precio-desc" ||
                params.orden === "municipio-asc" ||
                params.orden === "municipio-desc"
                  ? params.orden
                  : "",
            }}
          />
        </Suspense>
      </main>
    </>
  );
}
