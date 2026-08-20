import { NextResponse } from "next/server";
import { processPendingEmailQueue } from "@/lib/email-queue";
import { recordCronHeartbeat } from "@/lib/operational-monitoring";
import { queueMissingAvailabilityNotificationIntents } from "@/lib/property-availability-recovery";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";
import { createSignatureDeliveryRuntime } from "@/lib/signatures/runtime";

export const runtime = "nodejs";

async function handleEmailQueueRequest(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { ok: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  await recordCronHeartbeat("email_queue", "started").catch(() => undefined);
  try {
    const availabilityRecovery =
      await queueMissingAvailabilityNotificationIntents();
    const result = await processPendingEmailQueue();
    const signatureDeliveries = isSignerRuntimeEnabled()
      ? await createSignatureDeliveryRuntime().delivery.processPending(10)
      : { processed: 0, sent: 0, failed: 0, disabled: true };
    await recordCronHeartbeat("email_queue", "succeeded").catch(
      () => undefined
    );
    return NextResponse.json({ ok: true, availabilityRecovery, signatureDeliveries, ...result });
  } catch (error) {
    await recordCronHeartbeat("email_queue", "failed", error).catch(
      () => undefined
    );
    console.error("EMAIL QUEUE PROCESSOR ERROR", {
      message: error instanceof Error ? error.message : "Unknown error",
    });

    return NextResponse.json(
      { ok: false, error: "Email queue processing failed." },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return handleEmailQueueRequest(req);
}

export async function POST(req: Request) {
  return handleEmailQueueRequest(req);
}
