import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit } from "@/lib/api";
import { requireOwner, assertTheatreAccess } from "@/lib/owner";
import { generateLayout, rowLabelsFor, DEFAULT_PRICES } from "@/lib/geometry";

export const layoutSchema = z.object({
  screen: z.object({
    widthM: z.number().min(4).max(40),
    heightM: z.number().min(2).max(20),
    bottomY: z.number().min(0.5).max(6),
    z: z.number().min(0).max(10),
  }),
  firstRowZ: z.number().min(3).max(30),
  rowSpacingM: z.number().min(0.8).max(3),
  rowStepUpM: z.number().min(0).max(1.2),
  seatSpacingM: z.number().min(0.45).max(1.5),
  centerAisle: z.boolean(),
  aisleGapM: z.number().min(0.6).max(4),
  sideMarginM: z.number().min(0.5).max(6),
  eyeHeightM: z.number().min(0.8).max(1.5),
  rows: z
    .array(
      z.object({
        label: z.string().min(1).max(3),
        seats: z.number().int().min(1).max(40),
        categoryCode: z.string().min(2).max(16),
      })
    )
    .min(1)
    .max(30),
});

export const auditoriumCreateSchema = z.object({
  theatreId: z.string().min(5),
  name: z.string().min(2).max(80),
  layout: layoutSchema,
});

/** Creates categories + physical seats from a layout config. Shared by create & rebuild. */
export async function buildAuditoriumInventory(
  auditoriumId: string,
  layout: z.infer<typeof layoutSchema>
) {
  // categories from distinct row codes
  const codes = [...new Set(layout.rows.map((r) => r.categoryCode))];
  await db.seatCategory.deleteMany({ where: { auditoriumId } });
  const categories = await Promise.all(
    codes.map((code) => {
      const def = DEFAULT_PRICES[code] || { name: code.charAt(0) + code.slice(1).toLowerCase(), color: "#20D9E8", price: 200 };
      return db.seatCategory.create({
        data: { auditoriumId, code, name: def.name, color: def.color, basePrice: def.price },
      });
    })
  );
  const catByCode = new Map(categories.map((c) => [c.code, c]));

  await db.seat.deleteMany({ where: { auditoriumId } });
  const { seats } = generateLayout(layout as never);
  for (let c = 0; c < seats.length; c += 60) {
    await db.seat.createMany({
      data: seats.slice(c, c + 60).map((s) => ({
        auditoriumId,
        rowLabel: s.rowLabel,
        seatNumber: s.seatNumber,
        rowIndex: s.rowIndex,
        colIndex: s.colIndex,
        x: s.x,
        z: s.z,
        baseY: s.baseY,
        eyeHeight: s.eyeHeight,
        categoryId: catByCode.get(s.categoryCode)!.id,
        isAccessible: s.isAccessible,
      })),
    });
  }
  return { seatCount: seats.length, categories };
}

// GET /api/owner/auditoriums — list for owner
export const GET = handler(async () => {
  const user = await requireOwner();
  const auditoriums = await db.auditorium.findMany({
    where: user.role === "ADMIN" ? {} : { theatre: { ownerId: user.id } },
    include: {
      theatre: { select: { id: true, name: true, status: true } },
      _count: { select: { seats: true, shows: true } },
      models: { orderBy: { version: "desc" }, take: 1 },
    },
    orderBy: { createdAt: "desc" },
  });
  return ok({ auditoriums });
});

// POST /api/owner/auditoriums — create auditorium from a layout config
export const POST = handler(async (req: NextRequest) => {
  const user = await requireOwner();
  const body = await parseBody(req, auditoriumCreateSchema);
  const theatre = await assertTheatreAccess(user, body.theatreId);
  if (theatre.status !== "APPROVED") {
    return ok({ error: "Theatre is pending platform approval — auditoriums unlock after approval." }, { status: 409 });
  }

  // sanity: labels unique
  const labels = body.layout.rows.map((r) => r.label);
  if (new Set(labels).size !== labels.length) {
    return ok({ error: "Row labels must be unique." }, { status: 422 });
  }

  const auditorium = await db.auditorium.create({
    data: {
      theatreId: theatre.id,
      name: body.name.trim(),
      layoutConfig: JSON.stringify(body.layout),
      geometrySource: "PROCEDURAL",
      status: "PUBLISHED",
      models: {
        create: {
          kind: "PROCEDURAL",
          status: "PUBLISHED",
          version: 1,
          notes: "Procedural demonstration geometry generated from the layout configuration.",
        },
      },
    },
  });
  const { seatCount } = await buildAuditoriumInventory(auditorium.id, body.layout);
  await audit({ actorId: user.id, actorEmail: user.email, action: "AUDITORIUM_CREATED", entity: "Auditorium", entityId: auditorium.id, meta: { name: auditorium.name, seatCount } });
  return ok({ auditorium: { id: auditorium.id, name: auditorium.name }, seatCount }, { status: 201 });
});
