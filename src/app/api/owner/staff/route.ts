import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, fail, handler, parseBody, audit } from "@/lib/api";
import { requireOwner } from "@/lib/owner";
import { hashPassword } from "@/lib/auth";

const createSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email().max(160),
  password: z.string().min(8).max(72),
  theatreId: z.string().min(5),
});

// GET /api/owner/staff — staff members of the owner's theatres
export const GET = handler(async () => {
  const user = await requireOwner();
  const staff = await db.theatreStaff.findMany({
    where: user.role === "ADMIN" ? {} : { theatre: { ownerId: user.id } },
    include: {
      user: { select: { id: true, name: true, email: true, status: true, createdAt: true } },
      theatre: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return ok({ staff });
});

// POST /api/owner/staff — create a staff account scoped to one theatre
export const POST = handler(async (req: NextRequest) => {
  const user = await requireOwner();
  const body = await parseBody(req, createSchema);

  const theatre = await db.theatre.findUnique({ where: { id: body.theatreId } });
  if (!theatre) return fail("Theatre not found", 404);
  if (user.role !== "ADMIN" && theatre.ownerId !== user.id) {
    return fail("You can only add staff to your own theatres", 403);
  }

  const email = body.email.toLowerCase().trim();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    const alreadyStaff = await db.theatreStaff.findFirst({ where: { userId: existing.id, theatreId: theatre.id } });
    if (alreadyStaff) return fail("This user is already staff at this theatre", 409);
    // existing customer gets staff role + theatre link
    await db.user.update({ where: { id: existing.id }, data: { role: "STAFF" } });
    const link = await db.theatreStaff.create({ data: { theatreId: theatre.id, userId: existing.id } });
    await audit({ actorId: user.id, actorEmail: user.email, action: "STAFF_LINKED", entity: "TheatreStaff", entityId: link.id, meta: { email } });
    return ok({ staff: { id: link.id, reusedAccount: true } }, { status: 201 });
  }

  const newUser = await db.user.create({
    data: {
      email, name: body.name.trim(), passwordHash: await hashPassword(body.password),
      role: "STAFF", status: "ACTIVE",
    },
  });
  const link = await db.theatreStaff.create({ data: { theatreId: theatre.id, userId: newUser.id } });
  await audit({ actorId: user.id, actorEmail: user.email, action: "STAFF_CREATED", entity: "TheatreStaff", entityId: link.id, meta: { email } });
  return ok({ staff: { id: link.id, email: newUser.email, name: newUser.name } }, { status: 201 });
});
