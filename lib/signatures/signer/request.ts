import { cookies } from "next/headers";
import { createSignatureDomainRuntime } from "../runtime";
import { parseSignerCookie, SIGNER_COOKIE_NAME } from "./cookie";
export { isIsolatedLocalSignerRequest, sameSignerOrigin } from "./origin";

export async function requireSignerRequestContext(options?: { csrfNonce?: string; touch?: boolean }) {
  const cookieValue = (await cookies()).get(SIGNER_COOKIE_NAME)?.value;
  const parsed = parseSignerCookie(cookieValue);
  if (!parsed) throw new Error("signature_session_invalid");
  const runtime = createSignatureDomainRuntime();
  const context = await runtime.domain.getSessionContext({
    ...parsed,
    csrfNonce: options?.csrfNonce,
    touch: options?.touch,
  });
  return { runtime, ...parsed, context };
}
