import { createHash } from "node:crypto";

export const HEALTH_ALERT_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const CRON_STALE_MS = 27 * 60 * 60 * 1000;

export type HealthSnapshot = {
  staleProcessing: number;
  failedQueue: number;
  missingAvailabilityIntents: number;
  emailQueueLastSuccess: Date | null;
  adminCleanupLastSuccess: Date | null;
};

export function evaluateOperationalHealth(
  snapshot: HealthSnapshot,
  now = new Date()
) {
  const conditions: string[] = [];
  if (snapshot.staleProcessing > 0) conditions.push("email_queue_stale");
  if (snapshot.failedQueue >= 5) conditions.push("email_queue_failed_threshold");
  if (snapshot.missingAvailabilityIntents > 0) {
    conditions.push("availability_intents_missing");
  }
  if (
    !snapshot.emailQueueLastSuccess ||
    now.getTime() - snapshot.emailQueueLastSuccess.getTime() > CRON_STALE_MS
  ) {
    conditions.push("email_queue_cron_missing");
  }
  if (
    !snapshot.adminCleanupLastSuccess ||
    now.getTime() - snapshot.adminCleanupLastSuccess.getTime() > CRON_STALE_MS
  ) {
    conditions.push("admin_cleanup_cron_missing");
  }
  conditions.sort();
  const fingerprint = createHash("sha256")
    .update(conditions.join("|") || "healthy")
    .digest("hex");
  return { healthy: conditions.length === 0, conditions, fingerprint };
}

export function shouldEmitHealthAlert(input: {
  healthy: boolean;
  fingerprintChanged: boolean;
  lastAlertedAt: Date | null;
  now: Date;
}) {
  return (
    !input.healthy &&
    (input.fingerprintChanged ||
      !input.lastAlertedAt ||
      input.now.getTime() - input.lastAlertedAt.getTime() >=
        HEALTH_ALERT_COOLDOWN_MS)
  );
}

