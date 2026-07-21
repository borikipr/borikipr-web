export type EmailFailureKind = "retryable" | "permanent";

export type ImmediateDeliveryState =
  | "sent"
  | "queued"
  | "already_sent"
  | "already_queued"
  | "permanent_failure"
  | "failed_to_queue";

export function classifyEmailFailure(error: unknown): EmailFailureKind {
  const details = error as {
    name?: unknown;
    message?: unknown;
    statusCode?: unknown;
    status?: unknown;
    code?: unknown;
  };
  const status = Number(details?.statusCode ?? details?.status ?? 0);
  const code = String(details?.code ?? "").toUpperCase();
  const text = [details?.name, details?.message, details?.code]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (
    status === 408 ||
    status === 429 ||
    status >= 500 ||
    [
      "ETIMEDOUT",
      "ECONNRESET",
      "ECONNREFUSED",
      "EAI_AGAIN",
      "ENETUNREACH",
      "EPIPE",
      "UND_ERR_CONNECT_TIMEOUT",
      "UND_ERR_HEADERS_TIMEOUT",
    ].includes(code) ||
    text.includes("timeout") ||
    text.includes("timed out") ||
    text.includes("fetch failed") ||
    text.includes("network error") ||
    text.includes("temporarily unavailable") ||
    text.includes("temporary outage") ||
    text.includes("rate limit") ||
    text.includes("rate_limit") ||
    text.includes("quota") ||
    text.includes("daily limit") ||
    text.includes("monthly limit") ||
    text.includes("too many requests")
  ) {
    return "retryable";
  }

  return "permanent";
}

export async function attemptImmediateDelivery<T>({
  preflight,
  send,
  recordSuccess,
  enqueueRetry,
  serializeError,
  onPermanentFailure,
  onQueueFailure,
  onRecordFailure,
}: {
  preflight?: () => Promise<ImmediateDeliveryState | null>;
  send: () => Promise<T>;
  recordSuccess: (result: T) => Promise<void>;
  enqueueRetry: (lastError: string) => Promise<"queued" | "already_queued">;
  serializeError: (error: unknown) => string;
  onPermanentFailure: (error: unknown) => void;
  onQueueFailure: (error: unknown) => void;
  onRecordFailure: (error: unknown) => void;
}): Promise<ImmediateDeliveryState> {
  const existing = await preflight?.();
  if (existing) return existing;

  let result: T;
  try {
    result = await send();
  } catch (error) {
    if (classifyEmailFailure(error) === "permanent") {
      onPermanentFailure(error);
      return "permanent_failure";
    }

    try {
      return await enqueueRetry(serializeError(error));
    } catch (queueError) {
      onQueueFailure(queueError);
      return "failed_to_queue";
    }
  }

  try {
    await recordSuccess(result);
  } catch (error) {
    onRecordFailure(error);
  }
  return "sent";
}
