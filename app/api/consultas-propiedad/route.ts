import { handleOpenHouseRegistrationV2 } from "@/lib/leads/open-house-registration-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleOpenHouseRegistrationV2(request);
}
