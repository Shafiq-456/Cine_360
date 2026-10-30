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
import { Clock, Languages, Ticket, ExternalLink, MapPin, Armchair } from "lucide-react";

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
  movie: Movie;
  theatres: { theatre: { id: string; name: string; city: string; address: string }; shows: ShowRow[] }[];
};

function dayKey(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

export default function MovieDetailView({ id }: { id: string }) {
  const [data, setData] = useState<DetailData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [date, setDate] = useState<string>("");

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
          <div className="absolute inset-0 bg-gradient-to-t from-[#08090C] via-[#08090C]/70 to-transparent" />
        </div>
        <div className="relative p-6 md:p-10 flex flex-col md:flex-row gap-8">
          <div className="w-40 md:w-52 shrink-0 rounded-xl overflow-hidden border border-white/10 shadow-2xl">
            { }
            <img src={movie.posterUrl} alt={`${movie.title} poster`} className="w-full aspect-[2/3] object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-3xl md:text-5xl font-bold tracking-tight">{movie.title}</h1>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="px-2.5 py-1 rounded-md bg-[#20D9E8]/10 border border-[#20D9E8]/30 text-[#20D9E8] font-semibold">{movie.certification}</span>
              {movie.genres.map((g) => <span key={g} className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[#DDE1E8]">{g}</span>)}
            </div>
            <p className="mt-4 text-[#B9C4D6] leading-relaxed max-w-2xl">{movie.synopsis}</p>
            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#8FA3BF]">
              <span className="flex items-center gap-1.5"><Clock className="w-4 h-4" /> {movie.durationMins} min</span>
              <span className="flex items-center gap-1.5"><Languages className="w-4 h-4" /> {movie.languages.join(", ")}</span>
              {movie.releaseDate && <span>Released {new Date(movie.releaseDate).getFullYear()}</span>}
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              {movie.trailerUrl && (
                <a href={movie.trailerUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="border-white/15 hover:border-[#20D9E8]/60 hover:text-[#20D9E8]">
                    <ExternalLink className="w-4 h-4 mr-2" /> Watch trailer
                  </Button>
                </a>
              )}
              <Button className="bg-[#477BFF] hover:bg-[#5C89FF]" onClick={() => document.getElementById("showtimes")?.scrollIntoView({ behavior: "smooth" })}>
                <Ticket className="w-4 h-4 mr-2" /> Book tickets
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Showtimes */}
      <section id="showtimes" className="mt-12" aria-label="Showtimes">
        <h2 className="text-2xl font-bold mb-2">Showtimes</h2>
        <p className="text-sm text-[#8FA3BF] mb-6">Pick a show, then explore the auditorium in 3D.</p>

        {dates.length > 1 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {dates.map((d) => (
              <button
                key={d}
                onClick={() => setDate(d)}
                aria-pressed={date === d}
                className={`px-4 py-2 rounded-xl text-sm border transition-colors cursor-pointer ${
                  date === d ? "bg-[#477BFF] border-[#477BFF] text-white" : "border-white/10 text-[#8FA3BF] hover:text-white hover:border-[#477BFF]/50"
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
                    <p className="text-xs text-[#8FA3BF] mt-0.5 flex items-center gap-1"><MapPin className="w-3 h-3" /> {theatre.city} · {theatre.address}</p>
                  </div>
                  <Button variant="ghost" size="sm" className="text-[#477BFF]" onClick={() => navigate(`/theatres/${theatre.id}`)}>
                    Theatre details
                  </Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {dayShows.map((s) => {
                    const fill = s.totalSeats ? Math.round(((s.totalSeats - s.available) / s.totalSeats) * 100) : 0;
                    return (
                      <button
                        key={s.id}
                        onClick={() => navigate(`/book/${s.id}`)}
                        className={`border rounded-xl p-3.5 text-left transition-all cursor-pointer hover:border-[#477BFF]/60 hover:bg-[#477BFF]/5 ${
                          fill >= 90 ? "border-[#FF713D]/30" : "border-white/10"
                        }`}
                      >
                        <div className="font-semibold text-lg">{fmtTime(s.startsAt)}</div>
                        <div className="text-xs text-[#8FA3BF] mt-0.5">{s.auditorium.name}</div>
                        <div className="text-xs text-[#20D9E8] mt-1">{s.format} · {s.language}</div>
                        <div className="text-[11px] mt-2 text-[#8FA3BF]">
                          {s.available} of {s.totalSeats} seats free
                        </div>
                        <div className="mt-2 h-1 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${fill}%`, background: fill >= 90 ? "#FF713D" : fill >= 60 ? "#F5C518" : "#2FBF71" }} />
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
        <p className="text-xs text-[#8FA3BF]">
          Demo catalogue: real film metadata with procedurally generated demo artwork. Pricing shown per seat category in the booking view ({inr(180)}–{inr(420)}).
        </p>
      </section>
    </div>
  );
}
