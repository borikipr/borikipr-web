import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  parseAdminSessionValue,
  verifyLegacyAdminSession,
} from "@/lib/admin/auth-core";

const SESSION_COOKIE = "boriki_admin_session";
const PUBLIC_ADMIN_PATHS = new Set([
  "/admin/login",
  "/admin/forgot-password",
  "/admin/reset-password",
]);

function hasSignedSession(sessionValue: string | undefined) {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || !sessionValue) return false;
  return Boolean(
    parseAdminSessionValue(sessionValue, secret) ||
      verifyLegacyAdminSession(sessionValue, secret)
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (PUBLIC_ADMIN_PATHS.has(pathname)) return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  if (!hasSignedSession(session)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}
