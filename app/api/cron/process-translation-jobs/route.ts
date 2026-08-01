import { createPostgresTranslationDatabase } from "@/lib/i18n/translations/repository";
import { handleTranslationWorkerCron } from "@/lib/i18n/translations/cron-handler";
import { sql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function handle(request: Request) {
  return handleTranslationWorkerCron({
    request,
    database: createPostgresTranslationDatabase(sql),
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
