export const AUTH_COOKIE = "auth_session";
export const STATE_COOKIE = "auth_state";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 hari

export interface SessionUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
}

interface SessionPayload extends SessionUser {
  exp: number;
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(value: string): Uint8Array<ArrayBuffer> {
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET belum diatur di .env");
  return secret;
}

async function getKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const data = base64urlEncode(
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  const key = await getKey();
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );
  return `${data}.${base64urlEncode(new Uint8Array(sig))}`;
}

export async function verifySessionToken(
  token: string,
): Promise<SessionUser | null> {
  const dot = token.indexOf(".");
  if (dot === -1) return null;
  const data = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlDecode(sig),
      new TextEncoder().encode(data),
    );
    if (!valid) return null;
    const payload = JSON.parse(
      new TextDecoder().decode(base64urlDecode(data)),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) {
      return null;
    }
    return {
      login: payload.login,
      name: payload.name ?? null,
      avatarUrl: payload.avatarUrl ?? null,
    };
  } catch {
    return null;
  }
}

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    if (key) out[key] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

export function getOrigin(req: Request): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    "localhost:3000";
  return `${proto}://${host}`;
}
