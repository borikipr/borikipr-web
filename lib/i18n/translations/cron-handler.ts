import type { GoogleTranslationTransport } from "@/lib/i18n/translations/google-provider";
import type { TranslationDatabase } from "@/lib/i18n/translations/repository";
import { runConfiguredTranslationWorker } from "@/lib/i18n/translations/worker-entry";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

export async function handleTranslationWorkerCron(input: {
  request: Request;
  database: TranslationDatabase;
  env?: NodeJS.ProcessEnv;
  googleTransport?: GoogleTranslationTransport;
}) {
  const env = input.env ?? process.env;
  const secret = env.CRON_SECRET?.trim();
  if (
    !secret ||
    input.request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return Response.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: NO_STORE_HEADERS }
    );
  }
  try {
    const result = await runConfiguredTranslationWorker({
      database: input.database,
      env,
      googleTransport: input.googleTransport,
    });
    return Response.json(result, {
      status: result.state === "configuration_error" ? 503 : 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    console.error("translation_worker_cron_failed", {
      errorClass: error instanceof Error ? error.name : "UnknownError",
      environment: env.VERCEL_ENV || env.NODE_ENV || "unknown",
    });
    return Response.json(
      { ok: false, state: "failed", errorCode: "worker_failed" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
