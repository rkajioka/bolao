/**
 * Verificação de sessão compatível com Edge Runtime (middleware).
 * Usa apenas Web Crypto API; mesmo formato de cookie que lib/auth.ts.
 */

export interface Session {
  userId: string;
  role: "USER" | "ADMIN";
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "development") {
    return "dev-session-secret-at-least-32-characters";
  }
  throw new Error("SESSION_SECRET must be set and at least 32 characters");
}

function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncode(bytes: ArrayBuffer): string {
  const binary = String.fromCharCode(...new Uint8Array(bytes));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getSessionFromCookieValue(
  cookieValue: string | undefined
): Promise<Session | null> {
  if (!cookieValue) return null;
  const [encoded, signature] = cookieValue.split(".");
  if (!encoded || !signature) return null;
  try {
    const secret = getSecret();
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const payloadBytes = new TextEncoder().encode(encoded);
    const sigBuffer = await crypto.subtle.sign("HMAC", key, payloadBytes);
    const expectedSig = base64UrlEncode(sigBuffer);
    if (signature.length !== expectedSig.length) return null;
    const sigBytes = base64UrlDecode(signature);
    const expectedBytes = base64UrlDecode(expectedSig);
    if (sigBytes.length !== expectedBytes.length) return null;
    let eq = true;
    for (let i = 0; i < sigBytes.length; i++) {
      if (sigBytes[i] !== expectedBytes[i]) eq = false;
    }
    if (!eq) return null;
    const payloadJson = new TextDecoder().decode(base64UrlDecode(encoded));
    const payload = JSON.parse(payloadJson) as { userId?: string; role?: string; exp?: number };
    if (payload.exp && Date.now() > payload.exp) return null;
    if (!payload.userId || !payload.role) return null;
    if (payload.role !== "USER" && payload.role !== "ADMIN") return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = "bolao_session";
