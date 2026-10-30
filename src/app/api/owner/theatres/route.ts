import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit } from "@/lib/api";
import { requireOwner } from "@/lib/owner";

const createSchema = z.object({
  name: z.string().min(3).max(120),
  city: z.string().min(2).max(80),
  address: z.string().min(6).max(240),
  amenities: z.array(z.string().max(60)).max(12).default([]),
});

// GET /api/owner/theatres — the owner's theatres with auditorium summary
export const GET = handler(async () => {
  const user = await requireOwner();
  const theatres = await db.theatre.findMany({
    where: user.role === "ADMIN" ? {} : { ownerId: user.id },
    include: { auditoriums: { include: { _count: { select: { seats: true, shows: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return ok({ theatres });
});

// POST /api/owner/theatres — register a theatre (starts PENDING until admin approval)
export const POST = handler(async (req: NextRequest) => {
  const user = await requireOwner();
  const body = await parseBody(req, createSchema);
  const theatre = await db.theatre.create({
    data: {
      ownerId: user.id,
      name: body.name.trim(),
      city: body.city.trim(),
      address: body.address.trim(),
      amenities: JSON.stringify(body.amenities),
      status: user.role === "ADMIN" ? "APPROVED" : "PENDING",
    },
  });
  await audit({ actorId: user.id, actorEmail: user.email, action: "THEATRE_REGISTERED", entity: "Theatre", entityId: theatre.id, meta: { name: theatre.name } });
  return ok({ theatre }, { status: 201 });
});
