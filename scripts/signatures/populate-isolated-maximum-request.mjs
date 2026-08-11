import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createConfiguredSignatureDomainServices } from "../../lib/signatures/config.ts";
import { createPostgresSignatureDatabase } from "../../lib/signatures/domain/database.ts";
import { createIsolatedPGliteSql } from "../../lib/isolated-pg-sql.ts";

const root = path.dirname(fileURLToPath(new URL("../../package.json", import.meta.url)));
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:65432/isolated_signing";
const documentTitle = process.env.PHASE2K_MAXIMUM_DOCUMENT_TITLE ??
  "TEST NON-PRODUCTION Phase 2K maximum browser proof";
const expectedParticipants = Number(process.env.PHASE2K_MAXIMUM_PARTICIPANTS ?? "3");
if (
  process.env.SIGNING_ISOLATED_ENVIRONMENT !== "true" ||
  process.env.NODE_ENV === "production" ||
  !/^postgresql:\/\/postgres:postgres@127[.]0[.]0[.]1:65432\/isolated_signing$/.test(databaseUrl)
) {
  throw new Error("signature_isolated_maximum_population_forbidden");
}
if (![1, 3].includes(expectedParticipants) || !documentTitle.startsWith("TEST NON-PRODUCTION Phase 2K")) {
  throw new Error("signature_isolated_maximum_population_scope_invalid");
}

const secrets = JSON.parse(await readFile(path.join(root, "tmp", "signatures", "isolated-runtime-secrets.json"), "utf8"));
process.env.SIGNATURE_EVENT_HMAC_CURRENT_VERSION = "1";
process.env.SIGNATURE_EVENT_HMAC_KEYS_JSON = JSON.stringify({ 1: secrets.event });
process.env.SIGNATURE_NETWORK_EVIDENCE_HMAC_KEY = secrets.network;

const databasePath = path.join(root, "tmp", "signatures", "isolated-pglite");
const sql = createIsolatedPGliteSql(databasePath);
const database = createPostgresSignatureDatabase(sql);
const domain = createConfiguredSignatureDomainServices(database);

{
  const [document] = await sql`
    SELECT d.id::text, v.id::text AS version_id, v.page_geometry_manifest
      FROM public.signature_documents d
      JOIN public.signature_document_versions v ON v.id=d.active_version_id
     WHERE d.title=${documentTitle}
       AND d.status='draft'
  `;
  if (!document) throw new Error("signature_isolated_maximum_document_missing");
  const participants = await sql`
    SELECT id::text FROM public.signature_participants
     WHERE document_version_id=${document.version_id}::uuid ORDER BY routing_order, id
  `;
  if (participants.length !== expectedParticipants) throw new Error("signature_isolated_maximum_participants_invalid");
  const geometry = typeof document.page_geometry_manifest === "string"
    ? JSON.parse(document.page_geometry_manifest)
    : document.page_geometry_manifest;
  if (!Array.isArray(geometry) || geometry.length !== 25) {
    throw new Error("signature_isolated_maximum_geometry_invalid");
  }
  const existing = await sql`
    SELECT id::text FROM public.signature_fields
     WHERE document_version_id=${document.version_id}::uuid ORDER BY tab_order
  `;
  if (existing.length < 1 || existing.length > 100) {
    throw new Error("signature_isolated_maximum_seed_field_invalid");
  }
  const [admin] = await sql`
    SELECT id::text FROM public.admin_users WHERE username='synthetic-signing-admin'
  `;
  if (!admin) throw new Error("signature_isolated_maximum_admin_missing");

  const types = ["signature", "initials", "date", "text"];
  const positions = [
    { x: 0.08, y: 0.16 },
    { x: 0.56, y: 0.16 },
    { x: 0.08, y: 0.64 },
    { x: 0.56, y: 0.64 },
  ];
  for (let index = 0; index < 100; index += 1) {
    const pageIndex = Math.floor(index / 4);
    const fieldType = types[index % 4];
    const participantId = participants[index % participants.length].id;
    const position = positions[index % positions.length];
    const rect = {
      ...position,
      width: fieldType === "initials" || fieldType === "date" ? 0.18 : 0.3,
      height: 0.07,
    };
    const common = {
      participantId,
      fieldType,
      pageIndex,
      rect,
      pageGeometryReference: geometry[pageIndex],
      label: `Synthetic P${String(pageIndex + 1).padStart(2, "0")} ${fieldType}`,
      required: true,
      tabOrder: index + 1,
      validationLimits: fieldType === "text" ? { maxLength: 500 } : { maxLength: 120 },
      actorAdminId: admin.id,
      idempotencyKey: randomUUID(),
    };
    if (existing[index]) await domain.updateField({ fieldId: existing[index].id, ...common });
    else await domain.addField({ documentVersionId: document.version_id, ...common });
  }
  const [counts] = await sql`
    SELECT count(*)::int AS fields,
           count(DISTINCT participant_id)::int AS participants,
           count(DISTINCT page_index)::int AS pages
      FROM public.signature_fields WHERE document_version_id=${document.version_id}::uuid
  `;
  console.log(JSON.stringify({ ready: counts.fields === 100, ...counts }));
  // PGlite keeps an internal worker alive; this one-shot isolated fixture helper
  // exits only after every awaited domain mutation and aggregate verification.
  process.exit(counts.fields === 100 ? 0 : 1);
}
