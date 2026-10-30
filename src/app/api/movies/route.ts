import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { ok, handler, HttpError } from "@/lib/api";

// GET /api/movies?status=NOW_SHOWING|UPCOMING&q=&genre=&language=&featured=1
export const GET = handler(async (req: NextRequest) => {
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const q = sp.get("q")?.trim();
  const genre = sp.get("genre");
  const language = sp.get("language");
  const featured = sp.get("featured");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (featured === "1") where.featured = true;
  if (q) where.title = { contains: q };

  const movies = await db.movie.findMany({
    where,
    orderBy: [{ featured: "desc" }, { title: "asc" }],
    take: 60,
  });

  const filtered = movies.filter((m) => {
    const genres: string[] = JSON.parse(m.genres);
    const langs: string[] = JSON.parse(m.languages);
    if (genre && !genres.some((g) => g.toLowerCase() === genre.toLowerCase())) return false;
    if (language && !langs.some((l) => l.toLowerCase() === language.toLowerCase())) return false;
    return true;
  });

  return ok({
    movies: filtered.map((m) => ({
      ...m,
      genres: JSON.parse(m.genres),
      languages: JSON.parse(m.languages),
    })),
  });
});
