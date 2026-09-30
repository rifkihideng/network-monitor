import { NextResponse } from "next/server";
import { STATE_COOKIE, getOrigin } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GITHUB_CLIENT_ID belum diatur di .env" },
      { status: 500 },
    );
  }

  const state = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const redirectUri =
    process.env.GITHUB_REDIRECT_URI ?? `${getOrigin(req)}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "read:user",
    state,
    allow_signup: "true",
  });

  const res = NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params.toString()}`,
  );
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
