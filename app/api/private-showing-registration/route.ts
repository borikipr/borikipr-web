import { handlePrivateShowingRegistration } from "@/lib/leads/open-house-registration-handler";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handlePrivateShowingRegistration(request);
}
