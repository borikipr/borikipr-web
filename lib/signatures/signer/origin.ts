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

// Some mobile in-app browsers omit Origin on a top-level, same-origin form POST.
// This fallback is intentionally limited to the one-time token exchange. Browser-
// controlled Fetch Metadata must still prove a same-origin document navigation;
// all established-session mutations continue to require sameSignerOrigin + CSRF.
export function sameSignerExchangeOrigin(request: Request) {
  if (sameSignerOrigin(request)) return true;
  if (request.headers.get("origin")) return false;
  if (request.headers.get("sec-fetch-site") !== "same-origin" ||
      request.headers.get("sec-fetch-mode") !== "navigate" ||
      request.headers.get("sec-fetch-dest") !== "document") return false;
  const referer = request.headers.get("referer");
  if (!referer) return true;
  try { return new URL(referer).origin === new URL(request.url).origin; } catch { return false; }
}
