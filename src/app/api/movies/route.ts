import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler } from "@/lib/api";

// GET /api/movies?status=NOW_SHOWING|UPCOMING&q=&genre=&language=&featured=1&sortBy=popularity|title|releaseDate
export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const genre = sp.get("genre");
  const language = sp.get("language");
  const featured = sp.get("featured");
  const sortBy = sp.get("sortBy") || "popularity";

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (featured === "1") where.featured = true;
  if (q) where.title = { contains: q };

  let orderBy: any[] = [{ featured: "desc" }, { createdAt: "desc" }];
  if (sortBy === "title") {
    orderBy = [{ title: "asc" }];
  } else if (sortBy === "releaseDate") {
    orderBy = [{ releaseDate: "desc" }, { createdAt: "desc" }];
  } else if (sortBy === "duration") {
    orderBy = [{ durationMins: "desc" }];
  }

  const movies = await db.movie.findMany({
    where,
    orderBy,
    take: 60,
  });

  const filtered = movies.filter((m) => {
    let genres: string[] = [];
    let langs: string[] = [];
    try {
      genres = JSON.parse(m.genres);
    } catch {
      genres = [];
    }
    try {
      langs = JSON.parse(m.languages);
    } catch {
      langs = [];
    }
    if (genre && !genres.some((g) => g.toLowerCase() === genre.toLowerCase())) return false;
    if (language && !langs.some((l) => l.toLowerCase() === language.toLowerCase())) return false;
    return true;
  });

  return ok({
    movies: filtered.map((m) => ({
      ...m,
      genres: JSON.parse(m.genres || "[]"),
      languages: JSON.parse(m.languages || "[]"),
    })),
  });
});
