import { sql } from "../../lib/db";
import { createPostgresSignatureDatabase } from "../../lib/signatures/domain/database";
import { createSignatureGovernanceWorkflow } from "../../lib/signatures/governance-workflow";
import {
  authorizeProductionPublicLaunch,
  evaluatePublicLaunchReadiness,
  PUBLIC_LAUNCH_CONFIRMATION_PHRASE,
} from "../../lib/signatures/public-launch";

async function main() {
  const mode = process.argv[2];
  if (!["inspect", "revoke-stale-canary", "authorize-public"].includes(mode ?? "")) {
    throw new Error("usage: inspect | revoke-stale-canary | authorize-public");
  }
  const database = createPostgresSignatureDatabase(sql);
  const [settings] = await database.unsafe<{ broker_admin_user_id: string | null }>(
    `SELECT broker_admin_user_id::text FROM signature_signing_settings WHERE singleton=true`
  );
  if (!settings?.broker_admin_user_id) throw new Error("signature_broker_admin_not_configured");
  if (mode === "inspect") {
    const readiness = await evaluatePublicLaunchReadiness(database);
    const [authorizationCounts] = await database.unsafe<{
      active_public: number; active_canary: number;
    }>(`SELECT
      count(*) FILTER (WHERE authorization_type='production_public_launch' AND status='active')::int active_public,
      count(*) FILTER (WHERE authorization_type='internal_canary' AND status='active' AND expires_at>now())::int active_canary
      FROM signature_launch_authorizations WHERE environment='production'`);
    process.stdout.write(JSON.stringify({ status: readiness.overallStatus,
      blockers: readiness.blockers, readinessHash: readiness.readinessHash,
      documentTypes: readiness.documentTypes, locales: readiness.locales,
      authorizations: authorizationCounts }, null, 2));
    return;
  }
  if (mode === "revoke-stale-canary") {
    if (!process.argv.includes("--confirm-revoke")) throw new Error("signature_canary_revoke_confirmation_required");
    const authorizations = await database.unsafe<{ id: string }>(`SELECT id::text
      FROM signature_launch_authorizations
      WHERE environment='production' AND authorization_type='internal_canary' AND status='active'`);
    const workflow = createSignatureGovernanceWorkflow(database);
    for (const authorization of authorizations) {
      await workflow.revokeProductionCanary({ id: authorization.id,
        actorAdminId: settings.broker_admin_user_id, explicitConfirmation: true });
    }
    process.stdout.write(JSON.stringify({ revoked: authorizations.length }));
    return;
  }
  if (!process.argv.includes("--confirm-public-launch")) {
    throw new Error("signature_public_launch_confirmation_required");
  }
  const result = await authorizeProductionPublicLaunch({ database,
    actorAdminId: settings.broker_admin_user_id, explicitConfirmation: true,
    confirmationPhrase: PUBLIC_LAUNCH_CONFIRMATION_PHRASE,
    notes: "Canonical production public-launch readiness authorization" });
  process.stdout.write(JSON.stringify({ authorizationCreated: true,
    authorizationId: result.id, snapshotId: result.snapshotId,
    readinessHash: result.readinessHash, blockers: result.readiness.blockers }, null, 2));
}

void main().finally(() => sql.end());
