import bcrypt from "bcrypt";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import type { Role } from "@prisma/client";

const COOKIE_NAME = "bolao_session";
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const SALT_ROUNDS = 10;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === "development") {
    return "dev-session-secret-at-least-32-characters";
  }
  throw new Error("SESSION_SECRET must be set and at least 32 characters");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function verifySignature(payload: string, signature: string): boolean {
  const expected = sign(payload);
  if (signature.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(signature, "base64url"), Buffer.from(expected, "base64url"));
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface Session {
  userId: string;
  role: Role;
}

export async function createSession(userId: string, role: Role): Promise<void> {
  const payload = JSON.stringify({
    userId,
    role,
    exp: Date.now() + SESSION_DURATION_MS,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  const signature = sign(encoded);
  const value = `${encoded}.${signature}`;
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_DURATION_MS / 1000,
    path: "/",
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const value = cookieStore.get(COOKIE_NAME)?.value;
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  if (!verifySignature(encoded, signature)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (payload.exp && Date.now() > payload.exp) return null;
    if (!payload.userId || !payload.role) return null;
    return { userId: payload.userId, role: payload.role };
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    const { redirect } = await import("next/navigation");
    redirect("/login");
  }
  return session as Session;
}

export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
}
