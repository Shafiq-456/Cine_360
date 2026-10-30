import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { ok, handler, parseBody, audit } from "@/lib/api";
import { requireAuth } from "@/lib/auth";

const createSchema = z.object({
  title: z.string().min(1).max(160),
  synopsis: z.string().min(10).max(2000),
  languages: z.array(z.string().max(30)).min(1),
  genres: z.array(z.string().max(30)).min(1),
  durationMins: z.number().int().min(40).max(300),
  certification: z.string().min(1).max(8),
  status: z.enum(["NOW_SHOWING", "UPCOMING", "ARCHIVED"]).default("NOW_SHOWING"),
  featured: z.boolean().default(false),
  trailerUrl: z.string().max(300).optional(),
});

// GET /api/admin/movies
export const GET = handler(async () => {
  await requireAuth(["ADMIN"]);
  const movies = await db.movie.findMany({ include: { _count: { select: { shows: true } } }, orderBy: { createdAt: "desc" } });
  return ok({ movies: movies.map((m) => ({ ...m, genres: JSON.parse(m.genres), languages: JSON.parse(m.languages) })) });
});

// POST /api/admin/movies — add to catalogue (procedural poster generated from title)
export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAuth(["ADMIN"]);
  const body = await parseBody(req, createSchema);
  const slug = body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 60) || `movie-${Date.now()}`;

  const posterUrl = `/posters/${slug}.svg`;
  const backdropUrl = `/posters/${slug}-backdrop.svg`;
  // If no procedural artwork exists for this slug, fall back to the generic set
  let poster = posterUrl;
  try {
    const res = await fetch(`http://127.0.0.1:3000${posterUrl}`, { method: "HEAD" });
    if (!res.ok) poster = "/posters/interstellar.svg";
  } catch {
    poster = posterUrl;
  }

  const movie = await db.movie.create({
    data: {
      title: body.title, slug: `${slug}-${Date.now().toString(36).slice(-4)}`, synopsis: body.synopsis,
      posterUrl: poster, backdropUrl,
      languages: JSON.stringify(body.languages), genres: JSON.stringify(body.genres),
      durationMins: body.durationMins, certification: body.certification,
      status: body.status, featured: body.featured, trailerUrl: body.trailerUrl || null,
    },
  });
  await audit({ actorId: admin.id, actorEmail: admin.email, action: "MOVIE_CREATED", entity: "Movie", entityId: movie.id, meta: { title: movie.title } });
  return ok({ movie: { ...movie, genres: JSON.parse(movie.genres), languages: JSON.parse(movie.languages) } }, { status: 201 });
});
