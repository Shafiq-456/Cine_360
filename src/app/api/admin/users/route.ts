import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit, fail } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

const patchSchema = z.object({
  userId: z.string().min(5),
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

// GET /api/admin/users
export const GET = handler(async (req: NextRequest) => {
  await requireAuth(["ADMIN"]);
  const role = req.nextUrl.searchParams.get("role");
  const users = await db.user.findMany({
    where: role ? { role } : undefined,
    select: { id: true, name: true, email: true, role: true, status: true, createdAt: true, _count: { select: { bookings: true, theatres: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return ok({ users });
});

// PATCH /api/admin/users — activate / deactivate
export const PATCH = handler(async (req: NextRequest) => {
  const admin = await requireAuth(["ADMIN"]);
  const body = await parseBody(req, patchSchema);
  if (body.userId === admin.id) return fail("You cannot deactivate your own admin account", 409);

  const user = await db.user.update({ where: { id: body.userId }, data: { status: body.status } });
  await audit({ actorId: admin.id, actorEmail: admin.email, action: `USER_${body.status}`, entity: "User", entityId: user.id, meta: { email: user.email } });
  return ok({ user: { id: user.id, status: user.status } });
});
