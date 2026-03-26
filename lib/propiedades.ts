import { EstadoPropiedad, Propiedad, TipoNegocio, TipoPropiedad } from "@/data/listados";

export type Orden =
  | ""
  | "precio-asc"
  | "precio-desc"
  | "municipio-asc"
  | "municipio-desc";

export type FiltrosPropiedades = {
  tipoNegocio: "" | TipoNegocio;
  municipio: string;
  tipoPropiedad: "" | TipoPropiedad;
  precioMin: string;
  precioMax: string;
  orden: Orden;
};

export function formatoPrecio(precio: number, tipo: TipoNegocio) {
  return tipo === "renta"
    ? `$${precio.toLocaleString("en-US")}/mes`
    : `$${precio.toLocaleString("en-US")}`;
}

export function estadoLabel(estado: EstadoPropiedad) {
  switch (estado) {
    case "disponible":
      return "Disponible";
    case "bajo_contrato":
      return "Bajo contrato";
    case "vendida":
      return "Vendida";
    case "rentada":
      return "Rentada";
    default:
      return estado;
  }
}

export function estadoClasses(estado: EstadoPropiedad) {
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

export function filtrarPropiedades(
  propiedades: Propiedad[],
  filtros: FiltrosPropiedades
) {
  const filtradas = propiedades.filter((propiedad) => {
    const coincideNegocio = filtros.tipoNegocio
      ? propiedad.tipoNegocio === filtros.tipoNegocio
      : true;

    const coincideMunicipio = filtros.municipio
      ? propiedad.municipio === filtros.municipio
      : true;

    const coincideTipo = filtros.tipoPropiedad
      ? propiedad.tipoPropiedad === filtros.tipoPropiedad
      : true;

    const coincidePrecioMin = filtros.precioMin
      ? propiedad.precio >= Number(filtros.precioMin)
      : true;

    const coincidePrecioMax = filtros.precioMax
      ? propiedad.precio <= Number(filtros.precioMax)
      : true;

    return (
      coincideNegocio &&
      coincideMunicipio &&
      coincideTipo &&
      coincidePrecioMin &&
      coincidePrecioMax
    );
  });

  if (filtros.orden === "precio-asc") {
    filtradas.sort((a, b) => a.precio - b.precio);
  } else if (filtros.orden === "precio-desc") {
    filtradas.sort((a, b) => b.precio - a.precio);
  } else if (filtros.orden === "municipio-asc") {
    filtradas.sort((a, b) => a.municipio.localeCompare(b.municipio));
  } else if (filtros.orden === "municipio-desc") {
    filtradas.sort((a, b) => b.municipio.localeCompare(a.municipio));
  }

  return filtradas;
}

export function getPropiedadBySlug(propiedades: Propiedad[], slug: string) {
  return propiedades.find((item) => item.slug === slug);
}