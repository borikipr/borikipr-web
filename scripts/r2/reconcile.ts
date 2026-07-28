import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

async function main() {
  const apply = process.argv.includes("--apply");
  const confirmed = process.argv.includes(
    "--confirm=DELETE_ORPHANED_PUBLIC_MEDIA"
  );
  if (apply && !confirmed) {
    throw new Error(
      "Apply mode requires --confirm=DELETE_ORPHANED_PUBLIC_MEDIA."
    );
  }

  const { reconcileR2 } = await import("../../lib/r2-reconciliation");
  const report = await reconcileR2({ applyPublicMedia: apply });
  console.log(JSON.stringify(report, null, 2));
}

main().catch(() => {
  console.error("R2 reconciliation failed; sensitive details were suppressed.");
  process.exitCode = 1;
});

