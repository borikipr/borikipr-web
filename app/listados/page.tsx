import { Suspense } from "react";
import Header from "@/components/Header";
import ListadosClient from "@/components/ListadosClient";
import PropiedadSkeleton from "@/components/PropiedadSkeleton";
import { getPropiedadesPaginadas } from "@/lib/queries/propiedades";

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
  q?: string;
  page?: string;
}>;

export default async function ListadosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const data = await getPropiedadesPaginadas(page, 12);

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
        : ["/placeholder.jpg"],
  }));

  return (
    <>
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Listados</p>

            <h1 className="heading-section mt-4">
              Propiedades en venta y renta en Puerto Rico
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
              tipoPropiedad:
                params.tipoPropiedad === "Casa" ||
                params.tipoPropiedad === "Apartamento" ||
                params.tipoPropiedad === "Condominio" ||
                params.tipoPropiedad === "Terreno" ||
                params.tipoPropiedad === "Comercial"
                  ? params.tipoPropiedad
                  : "",
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
