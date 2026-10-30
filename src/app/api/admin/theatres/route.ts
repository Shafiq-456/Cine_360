import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit, HttpError } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

const patchSchema = z.object({
  theatreId: z.string().min(5),
  status: z.enum(["PENDING", "APPROVED", "SUSPENDED", "REJECTED"]),
});

// GET /api/admin/theatres — all theatres with owner info
export const GET = handler(async () => {
  await requireAuth(["ADMIN"]);
  const theatres = await db.theatre.findMany({
    include: {
      owner: { select: { id: true, name: true, email: true } },
      auditoriums: { include: { _count: { select: { seats: true, shows: true } } } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
  return ok({ theatres });
});

// PATCH /api/admin/theatres — approve / suspend / reject
export const PATCH = handler(async (req: NextRequest) => {
  const admin = await requireAuth(["ADMIN"]);
  const body = await parseBody(req, patchSchema);
  const theatre = await db.theatre.update({ where: { id: body.theatreId }, data: { status: body.status } });
  await audit({ actorId: admin.id, actorEmail: admin.email, action: `THEATRE_${body.status}`, entity: "Theatre", entityId: theatre.id, meta: { name: theatre.name } });
  return ok({ theatre });
});
