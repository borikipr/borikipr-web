import { NextResponse } from "next/server";
import {
  recordCronHeartbeat,
  runOperationalHealthAudit,
} from "@/lib/operational-monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  await recordCronHeartbeat("operational_health", "started");
  try {
    const health = await runOperationalHealthAudit();
    await recordCronHeartbeat("operational_health", "succeeded");
    if (health.alertDue) {
      console.error("operational_health_alert", {
        conditions: health.conditions,
        environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
      });
    }
    return NextResponse.json(
      {
        ok: health.healthy,
        healthy: health.healthy,
        conditions: health.conditions,
        alertEmitted: health.alertDue,
      },
      {
        status: health.healthy ? 200 : 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    await recordCronHeartbeat("operational_health", "failed", error).catch(
      () => undefined
    );
    console.error("operational_health_audit_failed", {
      errorClass: error instanceof Error ? error.name : "UnknownError",
      environment: process.env.VERCEL_ENV || process.env.NODE_ENV,
    });
    return NextResponse.json(
      { ok: false, error: "Operational health audit failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

