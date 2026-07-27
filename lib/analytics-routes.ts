export function isAdminAnalyticsPath(pathname: string | undefined | null) {
  if (!pathname) return false;

  try {
    const parsedPath = pathname.startsWith("http")
      ? new URL(pathname).pathname
      : pathname;

    return parsedPath === "/admin" || parsedPath.startsWith("/admin/");
  } catch {
    return false;
  }
}

export function isPrivateTokenizedPath(pathname: string | undefined | null) {
  if (!pathname) return false;
  try {
    const parsedPath = pathname.startsWith("http")
      ? new URL(pathname).pathname
      : pathname;
    return /^\/listados\/[^/]+\/visita\/[^/]+\/?$/.test(parsedPath);
  } catch {
    return false;
  }
}

export function shouldExcludeAnalyticsPath(
  pathname: string | undefined | null
) {
  return isAdminAnalyticsPath(pathname) || isPrivateTokenizedPath(pathname);
}

export function isPublicAnalyticsPath(pathname: string | undefined | null) {
  return !shouldExcludeAnalyticsPath(pathname);
}
