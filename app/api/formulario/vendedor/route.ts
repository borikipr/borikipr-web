import { handlePersistedSellerLandlordInquiry } from "@/lib/leads/seller-landlord-inquiry-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handlePersistedSellerLandlordInquiry(request);
}
