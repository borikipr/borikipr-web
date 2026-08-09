export const SIGNER_COOKIE_NAME = "borikipr_signer_session";
export const SIGNER_CSRF_COOKIE_NAME = "borikipr_signer_csrf";
export const SIGNER_COOKIE_PATH = "/firmar";

export function encodeSignerCookie(sessionId: string, sessionSecret: string) {
  return `${sessionId}.${sessionSecret}`;
}

export function parseSignerCookie(value: string | undefined | null) {
  const match = value?.match(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.([A-Za-z0-9_-]{43})$/i
  );
  return match ? { sessionId: match[1].toLowerCase(), sessionSecret: match[2] } : null;
}
