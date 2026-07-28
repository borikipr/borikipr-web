import { handlePersistedBuyerTenantInquiry } from "@/lib/leads/buyer-tenant-inquiry-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handlePersistedBuyerTenantInquiry(request);
}
