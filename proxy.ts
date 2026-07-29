import { NextResponse, type NextRequest } from "next/server";
import { middleware as adminMiddleware } from "@/lib/admin/middleware";
import {
  getPublicRequestLocale,
  PUBLIC_LOCALE_REQUEST_HEADER,
} from "@/lib/i18n/locales";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return adminMiddleware(request);
  }

  const locale = getPublicRequestLocale(pathname);
  if (!locale) return NextResponse.next();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(PUBLIC_LOCALE_REQUEST_HEADER, locale);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!admin|api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
