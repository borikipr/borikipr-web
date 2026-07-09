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

export function isPublicAnalyticsPath(pathname: string | undefined | null) {
  return !isAdminAnalyticsPath(pathname);
}
