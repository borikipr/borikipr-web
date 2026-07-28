import { sql } from "@/lib/db";
import { auditAvailabilityNotificationRecovery } from "@/lib/property-availability-recovery";
import {
  evaluateOperationalHealth,
  shouldEmitHealthAlert,
  type HealthSnapshot,
} from "@/lib/operational-monitoring-policy";

export type CronJobName =
  | "email_queue"
  | "admin_auth_cleanup"
  | "operational_health";

export async function recordCronHeartbeat(
  jobName: CronJobName,
  state: "started" | "succeeded" | "failed",
  error?: unknown
) {
  const errorClass =
    state === "failed"
      ? sanitizeErrorClass(
          error instanceof Error ? error.name : "UnknownOperationalError"
        )
      : null;
  await sql`
    INSERT INTO public.operational_cron_heartbeats (
      job_name, last_started_at, last_succeeded_at, last_failed_at,
      last_error_class, updated_at
    ) VALUES (
      ${jobName},
      CASE WHEN ${state} = 'started' THEN now() ELSE NULL END,
      CASE WHEN ${state} = 'succeeded' THEN now() ELSE NULL END,
      CASE WHEN ${state} = 'failed' THEN now() ELSE NULL END,
      ${errorClass},
      now()
    )
    ON CONFLICT (job_name) DO UPDATE SET
      last_started_at = CASE
        WHEN ${state} = 'started' THEN now()
        ELSE operational_cron_heartbeats.last_started_at
      END,
      last_succeeded_at = CASE
        WHEN ${state} = 'succeeded' THEN now()
        ELSE operational_cron_heartbeats.last_succeeded_at
      END,
      last_failed_at = CASE
        WHEN ${state} = 'failed' THEN now()
        ELSE operational_cron_heartbeats.last_failed_at
      END,
      last_error_class = CASE
        WHEN ${state} = 'failed' THEN ${errorClass}
        WHEN ${state} = 'succeeded' THEN NULL
        ELSE operational_cron_heartbeats.last_error_class
      END,
      updated_at = now()
  `;
}

export async function runOperationalHealthAudit(now = new Date()) {
  const [queueRows, heartbeatRows, availability] = await Promise.all([
    sql<
      { stale_processing: number; failed_queue: number }[]
    >`
      SELECT
        count(*) FILTER (
          WHERE status='processing'
            AND locked_at < now() - interval '15 minutes'
        )::int AS stale_processing,
        count(*) FILTER (WHERE status='failed')::int AS failed_queue
      FROM public.email_queue
    `,
    sql<{ job_name: string; last_succeeded_at: Date | null }[]>`
      SELECT job_name, last_succeeded_at
      FROM public.operational_cron_heartbeats
      WHERE job_name IN ('email_queue', 'admin_auth_cleanup')
    `,
    auditAvailabilityNotificationRecovery(),
  ]);
  const heartbeat = new Map(
    heartbeatRows.map((row) => [row.job_name, row.last_succeeded_at])
  );
  const snapshot: HealthSnapshot = {
    staleProcessing: queueRows[0]?.stale_processing ?? 0,
    failedQueue: queueRows[0]?.failed_queue ?? 0,
    missingAvailabilityIntents: availability.missingIntents,
    emailQueueLastSuccess: heartbeat.get("email_queue") ?? null,
    adminCleanupLastSuccess: heartbeat.get("admin_auth_cleanup") ?? null,
  };
  const health = evaluateOperationalHealth(snapshot, now);

  const state = await sql.begin(async (transaction) => {
    const existing = await transaction.unsafe<
      { fingerprint: string; last_alerted_at: Date | null }[]
    >(
      `SELECT fingerprint, last_alerted_at
         FROM public.operational_alert_state
        WHERE condition_key='global_health'
        FOR UPDATE`
    );
    const previous = existing[0] ?? null;
    const alertDue = shouldEmitHealthAlert({
      healthy: health.healthy,
      fingerprintChanged: previous?.fingerprint !== health.fingerprint,
      lastAlertedAt: previous?.last_alerted_at ?? null,
      now,
    });
    await transaction.unsafe(
      `INSERT INTO public.operational_alert_state (
         condition_key, fingerprint, active, first_detected_at,
         last_detected_at, last_alerted_at, resolved_at, updated_at
       ) VALUES (
         'global_health', $1, $2, $3, $3,
         CASE WHEN $4 THEN $3 ELSE NULL END,
         CASE WHEN $2 THEN NULL ELSE $3 END,
         $3
       )
       ON CONFLICT (condition_key) DO UPDATE SET
         fingerprint=EXCLUDED.fingerprint,
         active=EXCLUDED.active,
         first_detected_at=CASE
           WHEN operational_alert_state.active
            AND operational_alert_state.fingerprint=EXCLUDED.fingerprint
           THEN operational_alert_state.first_detected_at
           ELSE EXCLUDED.first_detected_at
         END,
         last_detected_at=EXCLUDED.last_detected_at,
         last_alerted_at=CASE
           WHEN $4 THEN EXCLUDED.last_detected_at
           ELSE operational_alert_state.last_alerted_at
         END,
         resolved_at=EXCLUDED.resolved_at,
         updated_at=EXCLUDED.updated_at`,
      [health.fingerprint, !health.healthy, now, alertDue]
    );
    return { alertDue };
  });

  return { ...health, ...snapshot, alertDue: state.alertDue };
}

function sanitizeErrorClass(value: string) {
  const safe = value.replace(/[^A-Za-z0-9_.:-]/g, "").slice(0, 120);
  return /^[A-Za-z]/.test(safe) ? safe : "OperationalError";
}
