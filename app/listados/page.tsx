import Header from "@/components/Header";
import ListadosClient from "@/components/ListadosClient";
import { getPropiedades } from "@/lib/queries/propiedades";

type TipoNegocio = "venta" | "renta";
type TipoPropiedad =
  | "Casa"
  | "Apartamento"
  | "Condominio"
  | "Terreno"
  | "Comercial";
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
};

type SearchParams = {
  municipio?: string;
  tipoNegocio?: string;
  tipoPropiedad?: string;
  precioMin?: string;
  precioMax?: string;
  orden?: string;
  q?: string;
};

export default async function ListadosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const rows = (await getPropiedades()) as unknown as PropiedadDB[];

  const propiedades = rows.map((p) => ({
    id: p.id,
    slug: p.slug,
    titulo: p.titulo,
    descripcion: p.descripcion,
    municipio: p.municipio,
    precio: Number(p.precio),
    tipo_negocio: p.tipo_negocio,
    tipo_propiedad: p.tipo_propiedad,
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

        <ListadosClient
          propiedades={propiedades}
          initialFilters={{
            q: searchParams.q ?? "",
            municipio: searchParams.municipio ?? "",
            tipoNegocio:
              searchParams.tipoNegocio === "venta" ||
              searchParams.tipoNegocio === "renta"
                ? searchParams.tipoNegocio
                : "",
            tipoPropiedad:
              searchParams.tipoPropiedad === "Casa" ||
              searchParams.tipoPropiedad === "Apartamento" ||
              searchParams.tipoPropiedad === "Condominio" ||
              searchParams.tipoPropiedad === "Terreno" ||
              searchParams.tipoPropiedad === "Comercial"
                ? searchParams.tipoPropiedad
                : "",
            precioMin: searchParams.precioMin ?? "",
            precioMax: searchParams.precioMax ?? "",
            orden:
              searchParams.orden === "precio-asc" ||
              searchParams.orden === "precio-desc" ||
              searchParams.orden === "municipio-asc" ||
              searchParams.orden === "municipio-desc"
                ? searchParams.orden
                : "",
          }}
        />
      </main>
    </>
  );
}