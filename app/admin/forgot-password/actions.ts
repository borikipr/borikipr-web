"use server";

import { getSessionSecret } from "@/lib/admin/auth";
import { RESET_RATE_LIMIT, RESET_RATE_WINDOW_MINUTES } from "@/lib/admin/auth-core";
import { completeAuthAttempt, requestAdminPasswordReset, reserveAuthAttempt } from "@/lib/admin/account";
import { getAuthRequestIdentifier } from "@/lib/admin/request-security";

export type ForgotPasswordState = { submitted: boolean };

export async function requestPasswordReset(
  _previous: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") || "").trim();
  const identifier = await getAuthRequestIdentifier("password-reset", email);
  const attemptId = await reserveAuthAttempt({
    attemptType: "password_reset_request",
    identifier,
    limit: RESET_RATE_LIMIT,
    windowMinutes: RESET_RATE_WINDOW_MINUTES,
    secret: getSessionSecret(),
  });
  if (attemptId) {
    try {
      await requestAdminPasswordReset(email);
      await completeAuthAttempt(attemptId, true);
    } catch {
      await completeAuthAttempt(attemptId, false);
      console.error("Admin password reset request failed without exposing account data.");
    }
  }
  return { submitted: true };
}
