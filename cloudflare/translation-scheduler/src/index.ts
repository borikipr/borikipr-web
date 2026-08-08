const TRANSLATION_WORKER_URL =
  "https://borikipr.com/api/cron/process-translation-jobs";
const REQUEST_TIMEOUT_MS = 45_000;

type SchedulerEnvironment = {
  TRANSLATION_CRON_SECRET?: string;
};

type SchedulerLogger = (
  event: string,
  details: Record<string, string | number | boolean | null>
) => void;

export type SchedulerResult = {
  ok: boolean;
  outcome:
    | "delivered"
    | "authentication_rejected"
    | "rate_limited"
    | "upstream_error"
    | "request_failed"
    | "request_timeout"
    | "configuration_error";
  status: number | null;
};

export function formatSchedulerLog(
  event: string,
  details: Record<string, string | number | boolean | null>
): string {
  return JSON.stringify({ event, ...details });
}

export async function invokeBorikiTranslationWorker(input: {
  secret: string | undefined;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  logger?: SchedulerLogger;
}): Promise<SchedulerResult> {
  const secret = input.secret?.trim();
  const log: SchedulerLogger = input.logger ?? (() => undefined);
  if (!secret) {
    const result: SchedulerResult = {
      ok: false,
      outcome: "configuration_error",
      status: null,
    };
    log("translation_scheduler_completed", result);
    return result;
  }

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? REQUEST_TIMEOUT_MS
  );
  const startedAt = Date.now();

  try {
    const response = await (input.fetchImpl ?? fetch)(TRANSLATION_WORKER_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
      },
      redirect: "error",
      signal: controller.signal,
    });
    // Delivery is determined by the upstream HTTP status. Discarding the body
    // is best-effort because some edge runtimes reject stream cancellation
    // after the response has already completed.
    try {
      await response.body?.cancel();
    } catch {
      // The response body is intentionally never read or logged.
    }

    const outcome: SchedulerResult["outcome"] = response.ok
      ? "delivered"
      : response.status === 401 || response.status === 403
        ? "authentication_rejected"
        : response.status === 429
          ? "rate_limited"
          : "upstream_error";
    const result: SchedulerResult = {
      ok: response.ok,
      outcome,
      status: response.status,
    };
    log("translation_scheduler_completed", {
      ...result,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (error) {
    const timeout = error instanceof Error && error.name === "AbortError";
    const result: SchedulerResult = {
      ok: false,
      outcome: timeout ? "request_timeout" : "request_failed",
      status: null,
    };
    log("translation_scheduler_completed", {
      ...result,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } finally {
    clearTimeout(timer);
  }
}

const scheduler = {
  async scheduled(
    _controller: ScheduledController,
    env: SchedulerEnvironment
  ): Promise<void> {
    await invokeBorikiTranslationWorker({
      secret: env.TRANSLATION_CRON_SECRET,
      logger: (event, details) => console.log(formatSchedulerLog(event, details)),
    });
  },
};

export default scheduler;

interface ScheduledController {
  cron: string;
  scheduledTime: number;
}
