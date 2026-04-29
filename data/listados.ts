export type TipoNegocio = "venta" | "renta";
export type TipoPropiedad =
  | "Casa"
  | "Apartamento"
  | "Condominio"
  | "Terreno"
  | "Comercial";

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
  origenListado: "propio" | "co_broke" | "externo";
}