import { headers } from "next/headers";
import { getSessionSecret } from "@/lib/admin/auth";
import { hashOpaqueValue } from "@/lib/admin/auth-core";

export async function getAuthRequestIdentifier(purpose: string, subject: string) {
  const requestHeaders = await headers();
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
  const clientAddress = forwarded || requestHeaders.get("x-real-ip") || "unknown";
  return hashOpaqueValue(
    `${purpose}:${clientAddress}:${subject.trim().toLowerCase()}`,
    getSessionSecret()
  );
}
