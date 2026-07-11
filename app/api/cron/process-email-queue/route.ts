import { NextResponse } from "next/server";
import { processPendingEmailQueue } from "@/lib/email-queue";

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

  try {
    const result = await processPendingEmailQueue();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
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
