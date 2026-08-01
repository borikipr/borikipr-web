export const PRODUCTION_READ_ONLY_DRY_RUN_FLAG =
  "--allow-production-read-only-dry-run";

type RuntimeEnvironment = Partial<
  Pick<NodeJS.ProcessEnv, "VERCEL_ENV" | "NODE_ENV">
>;

export function isProductionDatabaseConfiguration(input: {
  databaseUrl: string;
  environment?: RuntimeEnvironment;
}) {
  const url = new URL(input.databaseUrl);
  return (
    url.hostname.endsWith(".neon.tech") ||
    input.environment?.VERCEL_ENV === "production" ||
    input.environment?.NODE_ENV === "production"
  );
}

export function assertTranslationWorkerCliIsSafe(input: {
  databaseUrl: string;
  run: boolean;
  confirmedLocal: boolean;
  allowProductionReadOnlyDryRun: boolean;
  environment?: RuntimeEnvironment;
}) {
  const url = new URL(input.databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const production = isProductionDatabaseConfiguration(input);
  if (input.run && production) {
    throw new Error("Translation worker run mode refuses production configuration.");
  }
  if (production && !input.allowProductionReadOnlyDryRun) {
    throw new Error(
      `Production worker dry-run requires ${PRODUCTION_READ_ONLY_DRY_RUN_FLAG}.`
    );
  }
  if (input.run && (!input.confirmedLocal || !localHosts.has(url.hostname))) {
    throw new Error(
      "Worker run mode requires --run, --confirm-local, and a local database."
    );
  }
  return { productionReadOnlyDryRun: production && !input.run };
}

export function assertTranslationBackfillCliIsSafe(input: {
  databaseUrl: string;
  apply: boolean;
  confirmedLocal: boolean;
  allowProductionReadOnlyDryRun: boolean;
  environment?: RuntimeEnvironment;
}) {
  const url = new URL(input.databaseUrl);
  const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  const production = isProductionDatabaseConfiguration(input);
  if (input.apply && production) {
    throw new Error("Translation backfill apply mode refuses production configuration.");
  }
  if (production && !input.allowProductionReadOnlyDryRun) {
    throw new Error(
      `Production backfill dry-run requires ${PRODUCTION_READ_ONLY_DRY_RUN_FLAG}.`
    );
  }
  if (input.apply && (!input.confirmedLocal || !localHosts.has(url.hostname))) {
    throw new Error(
      "Apply mode is restricted to an explicitly confirmed local database."
    );
  }
  return { productionReadOnlyDryRun: production && !input.apply };
}
