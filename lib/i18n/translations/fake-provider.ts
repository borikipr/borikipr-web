import {
  TranslationProviderError,
  type TranslationProvider,
  type TranslationProviderRequest,
  type TranslationProviderResult,
} from "@/lib/i18n/translations/provider";

export type FakeProviderStep =
  | { type: "success"; text?: string; delayMs?: number }
  | { type: "retryable"; delayMs?: number }
  | { type: "permanent"; delayMs?: number }
  | { type: "timeout"; delayMs?: number };

function wait(delayMs: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timeout = setTimeout(resolve, delayMs);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true }
    );
  });
}

export class FakeTranslationProvider implements TranslationProvider {
  readonly id = "fake";
  readonly implementationVersion = "phase-3d-fixture-v1";
  readonly model = "deterministic-fixture";
  readonly requests: TranslationProviderRequest[] = [];
  private readonly steps: FakeProviderStep[];

  constructor(steps: FakeProviderStep[] = []) {
    this.steps = [...steps];
  }

  async translate(
    request: TranslationProviderRequest
  ): Promise<TranslationProviderResult> {
    this.requests.push({ ...request, signal: undefined });
    const step = this.steps.shift() ?? { type: "success" as const };
    if (step.delayMs) await wait(step.delayMs, request.signal);
    if (step.type === "timeout") {
      await wait(step.delayMs ?? 60_000, request.signal);
    }
    if (step.type === "retryable") {
      throw new TranslationProviderError(
        "retryable",
        "fake_retryable",
        "Synthetic retryable provider failure."
      );
    }
    if (step.type === "permanent") {
      throw new TranslationProviderError(
        "permanent",
        "fake_permanent",
        "Synthetic permanent provider failure."
      );
    }
    const translatedText =
      step.type === "success" && step.text !== undefined
        ? step.text
        : `[FAKE en-US] ${request.sourceText}`;
    return {
      translatedText,
      providerId: this.id,
      providerModel: this.model,
      providerVersion: this.implementationVersion,
      providerRequestId: `fake-${request.correlationId}`,
      usage: { characters: request.sourceText.length },
    };
  }
}
