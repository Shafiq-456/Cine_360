import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireAuth();
    const items = await db.watchlist.findMany({
      where: { userId: user.id },
      include: {
        movie: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ ok: true, data: items.map((i) => i.movie) });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to fetch watchlist" }, { status: error.status || 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { movieId } = body;
    if (!movieId) {
      return NextResponse.json({ ok: false, error: "Movie ID is required" }, { status: 400 });
    }

    const item = await db.watchlist.upsert({
      where: {
        userId_movieId: {
          userId: user.id,
          movieId,
        },
      },
      update: {},
      create: {
        userId: user.id,
        movieId,
      },
    });

    return NextResponse.json({ ok: true, data: item });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to update watchlist" }, { status: error.status || 401 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuth();
    const url = new URL(req.url);
    const movieId = url.searchParams.get("movieId");
    if (!movieId) {
      return NextResponse.json({ ok: false, error: "Movie ID is required" }, { status: 400 });
    }

    await db.watchlist.deleteMany({
      where: {
        userId: user.id,
        movieId,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || "Failed to remove from watchlist" }, { status: error.status || 401 });
  }
}
