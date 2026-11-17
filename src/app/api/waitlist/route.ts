import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    const items = await db.waitlist.findMany({
      where: { userId: user.id },
      include: {
        show: {
          include: {
            movie: true,
            auditorium: {
              include: { theatre: true },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, data: items });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to fetch waitlist" }, { status: error.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { showId } = body;
    if (!showId) {
      return NextResponse.json({ ok: false, error: "Show ID is required" }, { status: 400 });
    }

    const show = await db.show.findUnique({
      where: { id: showId },
      include: { movie: true },
    });

    if (!show) {
      return NextResponse.json({ ok: false, error: "Show not found" }, { status: 404 });
    }

    const item = await db.waitlist.upsert({
      where: {
        userId_showId: {
          userId: user.id,
          showId,
        },
      },
      update: { status: "WAITING" },
      create: {
        userId: user.id,
        showId,
        status: "WAITING",
      },
    });

    return NextResponse.json({ ok: true, data: item, message: `Joined waitlist for ${show.movie.title}` });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to join waitlist" }, { status: error.status || 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const showId = url.searchParams.get("showId");
    if (!showId) {
      return NextResponse.json({ ok: false, error: "Show ID is required" }, { status: 400 });
    }

    await db.waitlist.deleteMany({
      where: {
        userId: user.id,
        showId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to remove from waitlist" }, { status: error.status || 401 });
  }
}
