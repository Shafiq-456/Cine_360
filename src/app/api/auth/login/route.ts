import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, handler, parseBody, audit } from "@/lib/api";
import { verifyPassword, signToken, sessionCookieOptions, AUTH_COOKIE } from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await parseBody(req, schema);
  const user = await db.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });

  // Same error for unknown email / wrong password (no account enumeration)
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return fail("Invalid email or password", 401);
  }
  if (user.status !== "ACTIVE") {
    return fail("This account has been deactivated. Contact support for help.", 403);
  }

  const token = await signToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as "CUSTOMER" | "OWNER" | "STAFF" | "ADMIN",
  });
  await audit({ actorId: user.id, actorEmail: user.email, action: "LOGIN", entity: "User", entityId: user.id });

  const res = ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  res.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
  return res;
});
