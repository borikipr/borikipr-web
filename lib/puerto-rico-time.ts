const PUERTO_RICO_TIME_ZONE = "America/Puerto_Rico";

export function formatPuertoRicoDate(value: string | Date) {
  return new Intl.DateTimeFormat("es-PR", {
    timeZone: PUERTO_RICO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatPuertoRicoDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("es-PR", {
    timeZone: PUERTO_RICO_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
