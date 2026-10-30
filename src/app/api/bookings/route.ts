import { NextRequest } from "next/server";
import { z } from "zod";
import { ok, handler, parseBody } from "@/lib/api";
import { requireAuth } from "@/lib/auth";
import { createBookingFromHold } from "@/lib/booking";
import { db } from "@/lib/db";

const schema = z.object({ holdId: z.string().min(5) });

// POST /api/bookings — create PENDING_PAYMENT booking from an active hold
export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth();
  const body = await parseBody(req, schema);
  const created = await createBookingFromHold({ holdId: body.holdId, userId: user.id });

  const booking = await db.booking.findUnique({
    where: { id: created.id },
    include: {
      seats: true,
      hold: { select: { expiresAt: true } },
      show: {
        include: {
          movie: { select: { title: true, posterUrl: true, durationMins: true, certification: true } },
          auditorium: { include: { theatre: { select: { name: true, city: true, address: true } } } },
        },
      },
    },
  });
  return ok({ booking }, { status: 201 });
});
