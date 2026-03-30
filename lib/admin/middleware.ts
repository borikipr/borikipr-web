import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "boriki_admin_session";

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET no está configurado.");
  }

  return secret;
}

function signValue(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("hex");
}

function isValidSession(sessionValue: string) {
  const lastDot = sessionValue.lastIndexOf(".");

  if (lastDot === -1) return false;

  const username = sessionValue.slice(0, lastDot);
  const signature = sessionValue.slice(lastDot + 1);

  if (!username || !signature) return false;

  const expectedSignature = signValue(username);

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedBuffer);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return NextResponse.next();
  }

  if (pathname === "/admin/login") {
    const session = request.cookies.get(SESSION_COOKIE)?.value;

    if (session && isValidSession(session)) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }

    return NextResponse.next();
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;

  if (!session || !isValidSession(session)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};