import { NextResponse } from "next/server";
import { AUTH_COOKIE, parseCookies, verifySessionToken } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = parseCookies(req.headers.get("cookie"))[AUTH_COOKIE];
  const user = token ? await verifySessionToken(token) : null;
  return NextResponse.json({ user });
}
