import postgres from "postgres";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local", quiet: true });

const SUPER_ADMIN_ID = "3cefce78-7d62-485d-9faa-6fed1b6ae377";
const ADMIN_ID = "837a7fca-c067-4878-a4eb-01c12a4cf7ba";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", prepare: false, max: 1 });

async function main() {
try {
  await sql.begin(async (transaction) => {
    await transaction.unsafe("SELECT pg_advisory_xact_lock(hashtextextended('boriki-team-access-authority', 0))");
    if (new Set([SUPER_ADMIN_ID, ADMIN_ID]).size !== 2) {
      throw new Error("Canonical bootstrap account IDs must be distinct");
    }
    const accounts = await transaction.unsafe<{
      id: string;
      activo: boolean;
      account_state: string;
      system_role: string;
    }[]>(
      `SELECT id::text, activo, account_state, system_role
         FROM public.admin_users
        WHERE id IN ($1::uuid, $2::uuid)
        FOR UPDATE`,
      [SUPER_ADMIN_ID, ADMIN_ID],
    );
    if (accounts.length !== 2 || accounts.some((account) => !account.activo || account.account_state !== "active")) {
      throw new Error("Canonical bootstrap accounts are not distinct active accounts");
    }
    const elevated = await transaction.unsafe<{ id: string }[]>(
      `SELECT id::text FROM public.admin_users
        WHERE system_role IN ('super_admin', 'admin')
          AND id NOT IN ($1::uuid, $2::uuid)
        FOR UPDATE`,
      [SUPER_ADMIN_ID, ADMIN_ID],
    );
    if (elevated.length) throw new Error("Unexpected elevated account exists; bootstrap refused");
    const currentRoles = new Map(accounts.map((account) => [account.id, account.system_role]));
    if (currentRoles.get(SUPER_ADMIN_ID) === "super_admin" && currentRoles.get(ADMIN_ID) === "admin") {
      return;
    }
    await transaction.unsafe(
      `UPDATE public.admin_users
          SET system_role = CASE
            WHEN id = $1::uuid THEN 'super_admin'
            WHEN id = $2::uuid THEN 'admin'
            ELSE system_role
          END
        WHERE id IN ($1::uuid, $2::uuid)`,
      [SUPER_ADMIN_ID, ADMIN_ID],
    );
    for (const [targetId, role] of [[SUPER_ADMIN_ID, "super_admin"], [ADMIN_ID, "admin"]] as const) {
      await transaction.unsafe(
        `INSERT INTO public.admin_access_events (event_type, actor_admin_user_id, target_admin_user_id, metadata)
         VALUES ('system_role_changed', NULL, $1::uuid, $2::jsonb)`,
        [targetId, { source: "phase_11_5_bootstrap", after: role }],
      );
    }
  });
  console.log("Controlled Team & Access bootstrap completed.");
} finally {
  await sql.end({ timeout: 5 });
}
}

void main();
