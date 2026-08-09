export function isIsolatedLocalSignerRequest(request: Request) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.SIGNING_ISOLATED_ENVIRONMENT !== "true"
  ) return false;
  const requestUrl = new URL(request.url);
  return requestUrl.hostname === "127.0.0.1" || requestUrl.hostname === "localhost";
}

export function sameSignerOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return isIsolatedLocalSignerRequest(request);
  if (isIsolatedLocalSignerRequest(request)) {
    if (request.headers.get("sec-fetch-site") === "same-origin") return true;
    try {
      const supplied = new URL(origin);
      const requested = new URL(request.url);
      return (
        supplied.protocol === "http:" &&
        ["127.0.0.1", "localhost"].includes(supplied.hostname) &&
        supplied.port === requested.port
      );
    } catch {
      return false;
    }
  }
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
