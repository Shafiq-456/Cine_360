import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, HttpError, audit } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

const schema = z.object({ code: z.string().trim().min(8).max(64) });

// GET /api/tickets/[id] — ticket detail with QR (customer owns it, or staff/admin for validation view)
export const GET = handler(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireAuth();
  const { id } = await ctx.params;
  const ticket = await db.ticket.findFirst({
    where: { OR: [{ id }, { code: id }] },
    include: {
      booking: {
        include: {
          user: { select: { name: true, email: true } },
          show: {
            include: {
              movie: { select: { title: true, posterUrl: true } },
              auditorium: { include: { theatre: { select: { name: true, city: true, address: true } } } },
            },
          },
        },
      },
      validations: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });
  if (!ticket) throw new HttpError("Ticket not found", 404);

  const isOwn = ticket.booking.userId === user.id;
  const isPrivileged = ["STAFF", "OWNER", "ADMIN"].includes(user.role);
  if (!isOwn && !isPrivileged) throw new HttpError("You do not have access to this ticket", 403);

  const { ticketQRDataUrl } = await import("@/lib/tickets");
  return ok({ ticket: { ...ticket, qrDataUrl: await ticketQRDataUrl(ticket.code) } });
});
