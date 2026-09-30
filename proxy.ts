import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, verifySessionToken } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && (await verifySessionToken(token))) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", req.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Lindungi semua route kecuali aset statis, /login, /api/auth/*, dan /api/monitor.
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/monitor).*)",
  ],
};
