export type TipoNegocio = "venta" | "renta";
export type TipoPropiedad =
  | "Casa"
  | "Apartamento"
  | "Condominio"
  | "Terreno";

export type EstadoPropiedad =
  | "disponible"
  | "bajo_contrato"
  | "vendida"
  | "rentada";

export interface Propiedad {
  id: string;
  slug: string;
  titulo: string;
  descripcion: string;
  municipio: string;
  precio: number;
  tipoNegocio: TipoNegocio;
  tipoPropiedad: TipoPropiedad;
  habitaciones: number;
  banos: number;
  estacionamientos: number;
  metrosCuadrados: number;
  estado: EstadoPropiedad;
  imagenes: string[];
  destacado?: boolean;
}

export const propiedades: Propiedad[] = [
  {
    id: "1",
    slug: "residencia-moderna-guaynabo",
    titulo: "Residencia moderna con piscina",
    descripcion:
      "Propiedad moderna con diseño contemporáneo, amplios espacios interiores y piscina privada. Ubicada en zona exclusiva.",
    municipio: "Guaynabo",
    precio: 685000,
    tipoNegocio: "venta",
    tipoPropiedad: "Casa",
    habitaciones: 4,
    banos: 3,
    estacionamientos: 2,
    metrosCuadrados: 3200,
    estado: "disponible",
    imagenes: [
      "/listado-1.jpg",
      "/listado-1b.jpg",
      "/listado-1c.jpg",
    ],
    destacado: true,
  },
  {
    id: "2",
    slug: "apartamento-playa-dorado",
    titulo: "Apartamento elegante cerca de la playa",
    descripcion:
      "Apartamento moderno a pasos de la playa, con excelente ventilación y ubicación estratégica.",
    municipio: "Dorado",
    precio: 3200,
    tipoNegocio: "renta",
    tipoPropiedad: "Apartamento",
    habitaciones: 2,
    banos: 2,
    estacionamientos: 1,
    metrosCuadrados: 1100,
    estado: "disponible",
    imagenes: [
      "/listado-2.jpg",
      "/listado-2b.jpg",
    ],
  },
  {
    id: "3",
    slug: "condominio-vista-urbana-san-juan",
    titulo: "Condominio con vista urbana",
    descripcion:
      "Condominio con excelente iluminación natural y ubicación céntrica en San Juan.",
    municipio: "San Juan",
    precio: 425000,
    tipoNegocio: "venta",
    tipoPropiedad: "Condominio",
    habitaciones: 3,
    banos: 2,
    estacionamientos: 1,
    metrosCuadrados: 1500,
    estado: "bajo_contrato",
    imagenes: [
      "/listado-3.jpg",
    ],
  },
  {
    id: "4",
    slug: "casa-familiar-bayamon",
    titulo: "Casa familiar lista para mudarse",
    descripcion:
      "Casa cómoda y funcional en zona residencial tranquila. Ideal para familia.",
    municipio: "Bayamón",
    precio: 285000,
    tipoNegocio: "venta",
    tipoPropiedad: "Casa",
    habitaciones: 3,
    banos: 2,
    estacionamientos: 2,
    metrosCuadrados: 2100,
    estado: "disponible",
    imagenes: [
      "/listado-4.jpg",
    ],
  },
];