import { handlePersistedPropertyBuyerProfile } from "@/lib/leads/property-buyer-profile-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handlePersistedPropertyBuyerProfile(request);
}
