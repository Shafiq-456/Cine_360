import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, handler, parseBody, audit } from "@/lib/api";
import { hashPassword, signToken, sessionCookieOptions, AUTH_COOKIE } from "@/lib/auth";

const schema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(160),
  phone: z.string().max(20).optional(),
  password: z.string().min(8).max(72),
});

export const POST = handler(async (req: NextRequest) => {
  const body = await parseBody(req, schema);
  const email = body.email.toLowerCase().trim();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return fail("An account with this email already exists. Try signing in instead.", 409);

  const user = await db.user.create({
    data: {
      email,
      name: body.name.trim(),
      phone: body.phone?.trim() || null,
      passwordHash: await hashPassword(body.password),
      role: "CUSTOMER", // public registration is customers only; owner/staff accounts are provisioned separately
      status: "ACTIVE",
    },
  });

  const token = await signToken({ id: user.id, email: user.email, name: user.name, role: "CUSTOMER" });
  await audit({ actorId: user.id, actorEmail: user.email, action: "REGISTER", entity: "User", entityId: user.id });

  const res = ok({ user: { id: user.id, email: user.email, name: user.name, role: user.role } }, { status: 201 });
  res.cookies.set(AUTH_COOKIE, token, sessionCookieOptions());
  return res;
});
