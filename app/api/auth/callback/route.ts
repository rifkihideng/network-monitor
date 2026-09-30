import { NextResponse } from "next/server";
import {
  AUTH_COOKIE,
  STATE_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
  getOrigin,
  parseCookies,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookies = parseCookies(req.headers.get("cookie"));

  const fail = (reason: string) => {
    const res = NextResponse.redirect(new URL(`/login?error=${reason}`, url));
    res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
    return res;
  };

  if (!code || !state || state !== cookies[STATE_COOKIE]) {
    return fail("invalid_state");
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("config");

  const redirectUri =
    process.env.GITHUB_REDIRECT_URI ?? `${getOrigin(req)}/api/auth/callback`;

  try {
    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData = (await tokenRes.json()) as {
      access_token?: string;
      error?: string;
    };
    if (!tokenData.access_token) return fail("token");

    const userRes = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "User-Agent": "network-monitor",
        Accept: "application/json",
      },
    });
    if (!userRes.ok) return fail("user");
    const user = (await userRes.json()) as {
      login?: string;
      name?: string | null;
      avatar_url?: string | null;
    };
    if (!user.login) return fail("user");

    const token = await createSessionToken({
      login: user.login,
      name: user.name ?? null,
      avatarUrl: user.avatar_url ?? null,
    });

    const res = NextResponse.redirect(new URL("/", url));
    res.cookies.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });
    res.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return res;
  } catch {
    return fail("server");
  }
}
