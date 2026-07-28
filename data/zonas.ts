export const zonasPR = {
  metropolitana: {
    nombre: "Metropolitana",
    municipios: [
      "San Juan",
      "Carolina",
      "Bayamón",
      "Caguas",
      "Guaynabo",
      "Cataño",
      "Trujillo Alto",
      "Canóvanas",
      "Loíza",
      "Gurabo",
      "Juncos",
      "Las Piedras",
      "Humacao",
    ],
  },
  norte: {
    nombre: "Norte",
    municipios: [
      "Arecibo",
      "Quebradillas",
      "Hatillo",
      "Manatí",
      "Barceloneta",
      "Vega Baja",
      "Vega Alta",
      "Dorado",
      "Toa Baja",
      "Toa Alta",
      "Morovis",
      "Utuado",
      "Jayuya",
    ],
  },
  sur: {
    nombre: "Sur",
    municipios: [
      "Ponce",
      "Guánica",
      "Guayama",
      "Salinas",
      "Santa Isabel",
      "Coamo",
      "Villalba",
      "Juana Díaz",
      "Yauco",
      "Guayanilla",
      "Peñuelas",
      "Arroyo",
      "Patillas",
    ],
  },
  este: {
    nombre: "Este",
    municipios: [
      "Fajardo",
      "Luquillo",
      "Ceiba",
      "Naguabo",
      "Vieques",
      "Culebra",
      "Río Grande",
      "Maunabo",
      "Yabucoa",
    ],
  },
  oeste: {
    nombre: "Oeste",
    municipios: [
      "Mayagüez",
      "Cabo Rojo",
      "Lajas",
      "Sabana Grande",
      "San Germán",
      "Hormigueros",
      "Moca",
      "Aguada",
      "Isabela",
      "Quebradillas",
    ],
  },
  central: {
    nombre: "Central",
    municipios: [
      "Ponce",
      "Adjuntas",
      "Aibonito",
      "Barranquitas",
      "Cayey",
      "Cidra",
      "Comerio",
      "Corozal",
      "Juana Díaz",
      "Las Marías",
      "Lares",
      "Orocovis",
      "Villalba",
    ],
  },
} as const;

export type RegionSlug = keyof typeof zonasPR;

export const regionesPR = Object.keys(zonasPR) as RegionSlug[];

export function isRegionSlug(value: string | null | undefined): value is RegionSlug {
  return Boolean(value && Object.hasOwn(zonasPR, value));
}

export function getRegionByName(value: string) {
  const normalized = value.trim().toLocaleLowerCase("es-PR");
  return regionesPR.find(
    (region) => zonasPR[region].nombre.toLocaleLowerCase("es-PR") === normalized
  );
}

export function getMunicipiosForRegion(region: RegionSlug): readonly string[] {
  return zonasPR[region].municipios;
}

export function getRegionLabel(region: RegionSlug): string {
  return zonasPR[region].nombre;
}

export const todasLasZonas = Object.values(zonasPR).map((z) => z.nombre);

export const todosLosMunicipios = Object.values(zonasPR)
  .flatMap((z) => z.municipios)
  .filter((m, i, arr) => arr.indexOf(m) === i)
  .sort();

export function buscarSugerencias(query: string): {
  zonas: string[];
  municipios: string[];
} {
  const q = query.toLowerCase().trim();

  if (!q) {
    return { zonas: [], municipios: [] };
  }

  const zonas = todasLasZonas.filter((z) =>
    z.toLowerCase().includes(q)
  );

  const municipios = todosLosMunicipios.filter((m) =>
    m.toLowerCase().includes(q)
  );

  return { zonas, municipios };
}
