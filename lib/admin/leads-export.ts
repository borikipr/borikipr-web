export const LEADS_EXPORT_ROW_LIMIT = 5000;
export const LEADS_EXPORT_BYTE_LIMIT = 10 * 1024 * 1024;
export const LEADS_EXPORT_HEADERS = ["Tipo de registro", "Nombre / título del caso", "Integrantes", "Número de personas", "Contacto principal", "Email del contacto", "Teléfono del contacto", "Estado", "Fuentes", "Propiedad relacionada", "Municipio / contexto", "Fecha de creación", "Última actividad", "Próximo seguimiento"] as const;

export type LeadsExportRow = {
  recordType: string; name: string; members: string; personCount: number;
  primaryContact: string; email: string; phone: string; status: string;
  sources: string; property: string; context: string; created: string;
  lastActivity: string; nextFollowUp: string;
};

export class LeadsExportLimitError extends Error {
  constructor() { super("El archivo supera el límite de seguridad. Reduce los filtros e intenta nuevamente."); }
}

// Prefix a text apostrophe before formulas (including whitespace/control-prefix
// bypasses). Phone cells always use this Excel text marker, never a formula.
export function csvCell(value: string | number, forceText = false) {
  let text = String(value).replace(/\u0000/g, "");
  if (text && (forceText || /^[\s\u0000-\u001f]*[=+\-@]/u.test(text))) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function generateLeadsCsv(rows: LeadsExportRow[]) {
  if (rows.length > LEADS_EXPORT_ROW_LIMIT) throw new LeadsExportLimitError();
  const lines = [LEADS_EXPORT_HEADERS.map((value) => csvCell(value)).join(",")];
  let bytes = Buffer.byteLength("\uFEFF" + lines[0] + "\r\n", "utf8");
  for (const row of rows) {
    const values = [row.recordType, row.name, row.members, row.personCount, row.primaryContact, row.email, row.phone, row.status, row.sources, row.property, row.context, row.created, row.lastActivity, row.nextFollowUp];
    const line = values.map((value, index) => csvCell(value, index === 6)).join(",");
    bytes += Buffer.byteLength(line + "\r\n", "utf8");
    if (bytes > LEADS_EXPORT_BYTE_LIMIT) throw new LeadsExportLimitError();
    lines.push(line);
  }
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}
