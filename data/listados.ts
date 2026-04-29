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

export type OrigenListado = "propio" | "co_broke" | "externo";

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
  origen_listado: OrigenListado;
  corredor_colaborador_nombre?: string;
  corredor_colaborador_empresa?: string;
  corredor_colaborador_contacto?: string;
  enlace_original?: string;
  permiso_publicar_web: boolean;
  permiso_usar_fotos: boolean;
  notas_internas?: string;
}