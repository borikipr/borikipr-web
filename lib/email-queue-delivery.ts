export type EmailQueueDeliveryOutcome =
  | { status: "sent" }
  | { status: "retryable"; attempts: number }
  | { status: "failed"; attempts: number };

export async function deliverClaimedEmail({
  attempts,
  maximumAttempts,
  send,
  markSuccess,
  markFailure,
}: {
  attempts: number;
  maximumAttempts: number;
  send: () => Promise<void>;
  markSuccess: () => Promise<void>;
  markFailure: (input: {
    error: unknown;
    attempts: number;
    terminal: boolean;
  }) => Promise<void>;
}): Promise<EmailQueueDeliveryOutcome> {
  try {
    await send();
  } catch (error) {
    const nextAttempts = attempts + 1;
    const terminal = nextAttempts >= maximumAttempts;
    await markFailure({ error, attempts: nextAttempts, terminal });
    return {
      status: terminal ? "failed" : "retryable",
      attempts: nextAttempts,
    };
  }

  await markSuccess();
  return { status: "sent" };
}
