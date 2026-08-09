import { createHash } from "node:crypto";

export function sha256Hex(bytes: Uint8Array | string) {
  return createHash("sha256").update(bytes).digest("hex");
}
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)])
    );
  }
  return value;
}

export function canonicalJson(value: unknown) {
  return JSON.stringify(canonicalize(value));
}

export function hashFieldDefinitions(
  fields: readonly Readonly<{
    id: string;
    participantId: string;
    type: string;
    pageIndex: number;
    rect: unknown;
  }>[]
) {
  const definitions = fields
    .map(({ id, participantId, type, pageIndex, rect }) => ({
      id,
      pageIndex,
      participantId,
      rect,
      type,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
  return sha256Hex(canonicalJson(definitions));
}
