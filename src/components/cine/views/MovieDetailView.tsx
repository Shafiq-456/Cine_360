"use client";
// Movie detail: synopsis, trailer, showtimes grouped by theatre and date.
import { useEffect, useMemo, useState } from "react";
import { navigate } from "@/lib/router";
import { api, fmtTime, fmtDate, inr } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState, Spinner } from "./bits";
import type { Movie } from "./MoviesView";
import { Clock, Languages, Ticket, Play, X, MapPin, Armchair, Flame } from "lucide-react";

type ShowRow = {
  id: string;
  startsAt: string;
  language: string;
  format: string;
  auditorium: { id: string; name: string };
  totalSeats: number;
  available: number;
};

type DetailData = {
  movie: Movie & { trailerId?: string | null };
  theatres: { theatre: { id: string; name: string; city: string; address: string }; shows: ShowRow[] }[];
};

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function MovieDetailView({ id }: { id: string }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [date, setDate] = useState<string>("");
  const [trailerOpen, setTrailerOpen] = useState(false);

  // Close the trailer overlay with Escape (a11y)
  useEffect(() => {
    if (!trailerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTrailerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [trailerOpen]);

  useEffect(() => {
    api
      .get<DetailData>(`/api/movies/${id}`)
      .then((d) => {
        setData(d);
        const dates = [...new Set(d.theatres.flatMap((t) => t.shows.map((s) => dayKey(s.startsAt))))].sort();
        if (dates.length) setDate(dates[0]);
      })
      .catch(() => setNotFound(true));
  }, [id]);

  const dates = useMemo(
    () => (data ? [...new Set(data.theatres.flatMap((t) => t.shows.map((s) => dayKey(s.startsAt))))].sort() : []),
    [data]
  );

  if (notFound) return <EmptyState title="Movie not found" hint="It may have been removed from the catalogue." />;
  if (!data) return <div className="max-w-7xl mx-auto px-4 py-20"><Spinner label="Loading movie…" /></div>;

  const { movie } = data;

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden border border-white/5">
        <div className="absolute inset-0">
          { }
          <img src={movie.backdropUrl || movie.posterUrl} alt="" aria-hidden="true" className="w-full h-full object-cover opacity-30 blur-sm scale-110" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#120A1C] via-[#120A1C]/70 to-transparent" />
        </div>
        <div className="relative p-6 md:p-10 flex flex-col md:flex-row gap-8">
          <div className="w-40 md:w-52 shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
            { }
            <img src={movie.posterUrl} alt={`${movie.title} poster`} className="w-full aspect-[2/3] object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{movie.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-[#F2B04C]/10 border border-[#F2B04C]/30 text-[#F2B04C] font-semibold">{movie.certification}</span>
              {movie.genres.map((g) => <span key={g} className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[#EAE2FA]">{g}</span>)}
            </div>
            <p className="mt-4 text-[#D5C9F0] leading-relaxed max-w-2xl">{movie.synopsis}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#B4A6D4]">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {movie.durationMins} min</span>
              <span className="flex items-center gap-1.5"><Languages className="w-4 h-4" /> {movie.languages.join(", ")}</span>
              {movie.releaseDate && <span>Released {new Date(movie.releaseDate).getFullYear()}</span>}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {movie.trailerId ? (
                <Button variant="outline" className="border-[#F43F5E]/50 text-[#FF6B6B] hover:bg-[#F43F5E]/10 hover:text-[#FF6B6B]" onClick={() => setTrailerOpen(true)}>
                  <Play className="w-4 h-4 mr-2" /> Watch trailer
                </Button>
              ) : movie.trailerUrl ? (
                <a href={movie.trailerUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-white/15 hover:border-[#F2B04C]/60 hover:text-[#F2B04C]">
                    <Play className="w-4 h-4 mr-2" /> Watch trailer
                  </Button>
                </a>
              ) : null}
              <Button className="bg-[#8B5CF6] hover:bg-[#A78BFA]" onClick={() => document.getElementById("showtimes")?.scrollIntoView({ behavior: "smooth" })}>
                <Ticket className="w-4 h-4 mr-2" /> Book tickets
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes */}
      <section id="showtimes" className="mt-12" aria-label="Showtimes">
        <h2 className="text-2xl font-bold mb-2">Showtimes</h2>
        <p className="text-sm text-[#B4A6D4] mb-6">Pick a show, then explore the auditorium in 3D.</p>

        {dates.length > 1 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                aria-pressed={date === d}
                className={`px-4 py-2 rounded-xl text-sm border transition-colors cursor-pointer ${
                  date === d ? "bg-[#8B5CF6] border-[#8B5CF6] text-white" : "border-white/10 text-[#B4A6D4] hover:text-white hover:border-[#8B5CF6]/50"
                }`}
              >
                {fmtDate(d)}
              </button>
            ))}
          </div>
        )}

        {data.theatres.length === 0 && (
          <EmptyState
            icon={<Armchair className="w-6 h-6" />}
            title="No upcoming shows yet"
            hint="Theatre owners schedule new shows from the Owner Console — check back soon."
          />
        )}

        <div className="space-y-6">
          {data.theatres.map(({ theatre, shows }) => {
            const dayShows = shows.filter((s) => dayKey(s.startsAt) === date);
            if (dayShows.length === 0) return null;
            return (
              <div key={theatre.id} className="cine-card p-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                  <div>
                    <h3 className="font-semibold text-lg">{theatre.name}</h3>
                    <p className="text-xs text-[#B4A6D4] mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {theatre.city} · {theatre.address}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[#8B5CF6]" onClick={() => navigate(`/theatres/${theatre.id}`)}>
                    Theatre details
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {dayShows.map((s) => {
                    const fill = s.totalSeats ? Math.round(((s.totalSeats - s.available) / s.totalSeats) * 100) : 0;
                    const filling = fill >= 50 && fill < 85;
                    const almostFull = fill >= 85;
                    return (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/book/${s.id}`)}
                        className={`relative border rounded-xl p-3.5 text-left transition-all cursor-pointer hover:border-[#8B5CF6]/60 hover:bg-[#8B5CF6]/5 ${
                          almostFull ? "border-[#F0659A]/30" : "border-white/10"
                        }`}
                      >
                        {(filling || almostFull) && (
                          <span className={`absolute -top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide flex items-center gap-1 ${almostFull ? "bg-[#F0659A] text-white" : "bg-[#FFD166] text-[#3A2E00]"}`}>
                            <Flame className="w-2.5 h-2.5" /> {almostFull ? "ALMOST FULL" : "FILLING FAST"}
                          </span>
                        )}
                        <div className="font-semibold text-lg">{fmtTime(s.startsAt)}</div>
                        <div className="text-xs text-[#B4A6D4] mt-0.5">{s.auditorium.name}</div>
                        <div className="text-xs text-[#F2B04C] mt-1">{s.format} · {s.language}</div>
                        <div className="text-[11px] mt-2 text-[#B4A6D4]">
                          {s.available} of {s.totalSeats} seats free
                        </div>
                        <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${fill}%`, background: fill >= 90 ? "#F0659A" : fill >= 60 ? "#FFD166" : "#34D399" }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <Separator className="my-10 bg-white/5" />
        <p className="text-xs text-[#B4A6D4]">
          Demo catalogue: real film metadata and artwork for demonstration. Pricing shown per seat category in the booking view ({inr(180)}–{inr(420)}).
        </p>
      </section>

      {/* ==================== TRAILER OVERLAY ==================== */}
      {trailerOpen && movie.trailerId && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`${movie.title} official trailer`}
          onClick={() => setTrailerOpen(false)}
        >
          <div className="relative w-full max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm font-semibold text-white flex items-center gap-2">
                <Play className="w-4 h-4 text-[#F43F5E]" /> {movie.title} — Official trailer
              </div>
              <button
                onClick={() => setTrailerOpen(false)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
                aria-label="Close trailer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="relative rounded-xl overflow-hidden border border-white/15 shadow-2xl bg-black" style={{ aspectRatio: "16 / 9" }}>
              <iframe
                key={movie.trailerId}
                src={`https://www.youtube.com/embed/${movie.trailerId}?autoplay=1&rel=0`}
                title={`${movie.title} official trailer`}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
