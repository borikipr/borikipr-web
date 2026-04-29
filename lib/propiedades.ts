import {
  EstadoPropiedad,
  Propiedad,
  TipoNegocio,
  TipoPropiedad,
} from "@/data/listados";

export type Orden =
  | ""
  | "precio-asc"
  | "precio-desc"
  | "municipio-asc"
  | "municipio-desc";

export type FiltrosPropiedades = {
  q: string;
  tipoNegocio: "" | TipoNegocio;
  municipio: string;
  tipoPropiedad: TipoPropiedad[];
  precioMin: string;
  precioMax: string;
  habitaciones: string;
  banos: string;
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
  const textoBusqueda = filtros.q.trim().toLowerCase();

  const filtradas = propiedades.filter((propiedad) => {
    const coincideTexto = textoBusqueda
      ? propiedad.titulo.toLowerCase().includes(textoBusqueda) ||
        propiedad.descripcion.toLowerCase().includes(textoBusqueda) ||
        propiedad.municipio.toLowerCase().includes(textoBusqueda) ||
        propiedad.tipoPropiedad.toLowerCase().includes(textoBusqueda)
      : true;

    const coincideNegocio = filtros.tipoNegocio
      ? propiedad.tipoNegocio === filtros.tipoNegocio
      : true;

    const coincideMunicipio = filtros.municipio
      ? propiedad.municipio === filtros.municipio
      : true;

    const coincideTipo = filtros.tipoPropiedad.length > 0
      ? filtros.tipoPropiedad.includes(propiedad.tipoPropiedad)
      : true;

    const coincidePrecioMin = filtros.precioMin
      ? propiedad.precio >= Number(filtros.precioMin)
      : true;

    const coincidePrecioMax = filtros.precioMax
      ? propiedad.precio <= Number(filtros.precioMax)
      : true;

    const minHabitaciones = filtros.habitaciones ? parseInt(filtros.habitaciones.replace('+', '')) : 0;
    const coincideHabitaciones = minHabitaciones > 0
      ? propiedad.habitaciones >= minHabitaciones
      : true;

    const minBanos = filtros.banos ? parseInt(filtros.banos.replace('+', '')) : 0;
    const coincideBanos = minBanos > 0
      ? propiedad.banos >= minBanos
      : true;

    return (
      coincideTexto &&
      coincideNegocio &&
      coincideMunicipio &&
      coincideTipo &&
      coincidePrecioMin &&
      coincidePrecioMax &&
      coincideHabitaciones &&
      coincideBanos
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
