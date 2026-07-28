import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
config({ quiet: true });

const APPLY_CONFIRMATION = "QUEUE_AVAILABILITY_GAPS";

async function main() {
  const {
    auditAvailabilityNotificationRecovery,
    queueMissingAvailabilityNotificationIntents,
  } = await import("../../lib/property-availability-recovery");
  const { sql } = await import("../../lib/db");
  try {
    const apply = process.argv.includes("--apply");
    const confirmation = process.argv.find((argument) =>
      argument.startsWith("--confirm=")
    );
    const audit = await auditAvailabilityNotificationRecovery();

    console.info("AVAILABILITY RECOVERY AUDIT", {
      mode: apply ? "apply" : "dry-run",
      ...audit,
    });

    if (!apply) {
      console.info(
        `Dry run only. To queue reviewed gaps, use --apply --confirm=${APPLY_CONFIRMATION}.`
      );
      return;
    }
    if (confirmation !== `--confirm=${APPLY_CONFIRMATION}`) {
      throw new Error("Explicit availability recovery confirmation is required.");
    }

    const result = await queueMissingAvailabilityNotificationIntents();
    console.info("AVAILABILITY RECOVERY RESULT", result);
    console.info(
      "No email was sent by this command. Queued intents remain subject to the normal queue processor."
    );
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error("AVAILABILITY RECOVERY FAILED", {
    name: error instanceof Error ? error.name : "Error",
    message:
      error instanceof Error
        ? error.message
        : "Availability recovery failed unexpectedly.",
  });
  process.exitCode = 1;
});
