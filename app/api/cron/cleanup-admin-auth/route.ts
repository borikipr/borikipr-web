import { NextResponse } from "next/server";
import {
  cleanupAdminAuthenticationRecords,
  type AdminAuthCleanupResult,
} from "@/lib/admin/auth-maintenance";
import { recordCronHeartbeat } from "@/lib/operational-monitoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CleanupFunction = () => Promise<AdminAuthCleanupResult>;

export async function handleAdminAuthCleanupRequest(
  request: Request,
  cleanup: CleanupFunction = cleanupAdminAuthenticationRecords
) {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const startedAt = Date.now();
  await recordCronHeartbeat("admin_auth_cleanup", "started").catch(
    () => undefined
  );
  try {
    const result = await cleanup();
    await recordCronHeartbeat("admin_auth_cleanup", "succeeded").catch(
      () => undefined
    );
    const durationMs = Date.now() - startedAt;
    console.info("ADMIN AUTH CLEANUP COMPLETE", {
      ...result,
      durationMs,
    });
    return NextResponse.json(
      { ok: true, ...result, durationMs },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    await recordCronHeartbeat("admin_auth_cleanup", "failed", error).catch(
      () => undefined
    );
    console.error("ADMIN AUTH CLEANUP FAILED");
    return NextResponse.json(
      { ok: false, error: "Authentication maintenance failed." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function GET(request: Request) {
  return handleAdminAuthCleanupRequest(request);
}
