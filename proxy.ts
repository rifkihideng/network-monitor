import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, NEXT_COOKIE, verifySessionToken } from "./lib/auth";

export async function proxy(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token && (await verifySessionToken(token))) {
    return NextResponse.next();
  }

  const nextPath = req.nextUrl.pathname + req.nextUrl.search;
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", nextPath);
  const res = NextResponse.redirect(loginUrl);
  res.cookies.set(NEXT_COOKIE, nextPath, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}

export const config = {
  matcher: [
    // Lindungi semua route kecuali aset statis, /login, /api/auth/*, dan /api/monitor.
    "/((?!_next/static|_next/image|favicon.ico|login|api/auth|api/monitor).*)",
  ],
};
