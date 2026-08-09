import type { SignatureQueryExecutor } from "./domain/types";

export async function inspectSignatureEventKeyCoverage(
  database: SignatureQueryExecutor,
  configuredKeyVersions: readonly number[],
  currentVersion: number
) {
  const rows = await database.unsafe<{ key_version: number }>(
    `SELECT DISTINCT key_version FROM public.signature_events ORDER BY key_version`
  );
  const usedKeyVersions = rows.map((row) => Number(row.key_version));
  const configured = new Set(configuredKeyVersions);
  const missingKeyVersions = usedKeyVersions.filter((version) => !configured.has(version));
  const currentVersionConfigured = configured.has(currentVersion);
  return Object.freeze({
    safe: missingKeyVersions.length === 0 && currentVersionConfigured,
    currentVersion,
    currentVersionConfigured,
    configuredKeyVersions: Object.freeze([...configuredKeyVersions]),
    usedKeyVersions: Object.freeze(usedKeyVersions),
    missingKeyVersions: Object.freeze(missingKeyVersions),
  });
}

export async function assertSignatureEventKeyCoverage(
  database: SignatureQueryExecutor,
  configuredKeyVersions: readonly number[],
  currentVersion: number
) {
  const result = await inspectSignatureEventKeyCoverage(
    database,
    configuredKeyVersions,
    currentVersion
  );
  if (!result.safe) throw new Error("signature_historical_event_key_missing");
  return result;
}
