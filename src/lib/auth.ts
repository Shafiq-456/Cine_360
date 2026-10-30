// Authentication: JWT (jose) + bcrypt password hashing + role guards.
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { db } from "./db";
import { ROLES, type Role } from "./constants";

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "cine360-demo-secret-change-in-production"
);
export const AUTH_COOKIE = "c360_token";
const TOKEN_TTL = "7d";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
};

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signToken(payload: SessionUser): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (!payload.id || !payload.email) return null;
    return {
      id: payload.id as string,
      email: payload.email as string,
      name: (payload.name as string) || "",
      role: (payload.role as Role) || ROLES.CUSTOMER,
    };
  } catch {
    return null;
  }
}

/** Reads the session from the httpOnly cookie (server side only). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

/** Requires an authenticated session; optionally one of the given roles. */
export async function requireAuth(roles?: Role[]): Promise<SessionUser> {
  const session = await getSession();
  if (!session) throw new AuthError("Authentication required", 401);
  if (roles && roles.length > 0 && !roles.includes(session.role)) {
    throw new AuthError("You do not have permission to perform this action", 403);
  }
  // Confirm the account is still active / role still valid (defense against stale tokens)
  const user = await db.user.findUnique({ where: { id: session.id } });
  if (!user || user.status !== "ACTIVE") throw new AuthError("Account is inactive", 403);
  return { id: user.id, email: user.email, name: user.name, role: user.role as Role };
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  };
}
