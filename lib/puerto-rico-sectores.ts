export const sectoresPorMunicipio: Record<string, string[]> = {
  Ponce: ["Coto Laurel", "Playa", "Portugués"],
  Guánica: ["Ensenada"],
  "Cabo Rojo": ["Boquerón", "Joyuda"],
  "San Juan": ["Santurce", "Río Piedras", "Hato Rey", "Condado", "Viejo San Juan", "Miramar"],
  Carolina: ["Isla Verde"],
  Guaynabo: ["Caparra", "Torrimar"],
  "Toa Baja": ["Levittown"],
};

export function getSectoresForMunicipio(municipio: string) {
  return sectoresPorMunicipio[municipio] ?? [];
}

export function normalizeSectorForMunicipio(municipio: string, sector: string) {
  const trimmedSector = sector.trim();
  const sectores = getSectoresForMunicipio(municipio);

  return sectores.includes(trimmedSector) ? trimmedSector : "";
}

export function formatPropertyLocation(municipio: string, sectorComunidad?: string | null) {
  const sector = sectorComunidad?.trim();

  return sector
    ? `${sector}, ${municipio}, Puerto Rico`
    : `${municipio}, Puerto Rico`;
}
