import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { connectDB } from "./mongodb";

export const COOKIE = "ns_token";
const MAX_AGE = 60 * 60 * 24 * 7;

export type Role = "admin" | "member";
export type Session = { id: string; name: string; role: Role; email: string };

const secret = () => new TextEncoder().encode(process.env.JWT_SECRET || "change-this-secret");

export async function signToken(s: Session) {
  return new SignJWT(s).setProtectedHeader({ alg: "HS256" }).setExpirationTime("7d").sign(secret());
}

export async function verifyToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function getSession() {
  return verifyToken((await cookies()).get(COOKIE)?.value);
}

export function setAuthCookie(res: NextResponse, token: string) {
  res.cookies.set(COOKIE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: MAX_AGE });
}

export const unauthorized = () => NextResponse.json({ error: "Please log in again." }, { status: 401 });
export const forbidden = (msg = "Only an admin can do this.") => NextResponse.json({ error: msg }, { status: 403 });
export const bad = (msg: string, status = 400) => NextResponse.json({ error: msg }, { status });

// Each database round trip is slow (~250ms to Atlas), so a user's
// active/role check is reused for a short while instead of on every call.
const USER_TTL_MS = 30_000;
const userCache = new Map<string, { session: Session | null; at: number }>();

/** Forget a cached user so role/active changes apply on their next request. */
export function forgetUser(id: string) {
  userCache.delete(id);
}

/**
 * For route handlers: `const s = await requireUser(); if (s instanceof NextResponse) return s;`
 * Re-reads the user (cached up to 30s) so switching someone off, or changing
 * their role, takes effect quickly instead of when their 7-day token expires.
 */
export async function requireUser(): Promise<Session | NextResponse> {
  const s = await getSession();
  if (!s || !ObjectId.isValid(s.id)) return unauthorized();
  const hit = userCache.get(s.id);
  if (hit && Date.now() - hit.at < USER_TTL_MS) return hit.session ?? unauthorized();

  const db = await connectDB();
  const user = await db.collection("users").findOne(
    { _id: new ObjectId(s.id), deleted: { $ne: true }, active: { $ne: false } },
    { projection: { name: 1, role: 1, email: 1 } },
  );
  const session: Session | null = user
    ? { id: s.id, name: user.name, role: user.role === "admin" ? "admin" : "member", email: user.email }
    : null;
  userCache.set(s.id, { session, at: Date.now() });
  return session ?? unauthorized();
}

export async function requireAdmin(): Promise<Session | NextResponse> {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  return s.role === "admin" ? s : forbidden();
}
