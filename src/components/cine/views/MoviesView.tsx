"use client";
// Movie discovery: search, filters, grid.
import { useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api, inr } from "@/lib/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageTitle, EmptyState, Spinner } from "./bits";
import { Search, Film, Clock } from "lucide-react";

export type Movie = {
  id: string;
  slug: string;
  title: string;
  synopsis: string;
  posterUrl: string;
  backdropUrl?: string;
  languages: string[];
  genres: string[];
  durationMins: number;
  certification: string;
  releaseDate?: string;
  trailerUrl?: string;
  status: string;
  featured: boolean;
  minPrice?: number;
};

const LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Malayalam", "Kannada"];
const GENRES = ["Sci-Fi", "Action", "Thriller", "Drama", "Romance", "Comedy", "Adventure", "History", "Fantasy"];

export default function MoviesView({ params }: { params: URLSearchParams }) {
  const [movies, setMovies] = useState<Movie[] | null>(null);
  const [q, setQ] = useState(params.get("q") || "");
  const [lang, setLang] = useState(params.get("language") || "");
  const [genre, setGenre] = useState(params.get("genre") || "");
  const [status, setStatus] = useState(params.get("status") || "NOW_SHOWING");

  useEffect(() => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set("q", q.trim());
    if (lang) sp.set("language", lang);
    if (genre) sp.set("genre", genre);
    if (status) sp.set("status", status);
    const t = setTimeout(() => {
      api
        .get<{ movies: Movie[] }>(`/api/movies?${sp.toString()}`)
        .then((d) => setMovies(d.movies))
        .catch(() => setMovies([]));
    }, 250);
    return () => clearTimeout(t);
  }, [q, lang, genre, status]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <PageTitle
        title={status === "UPCOMING" ? "Upcoming releases" : "All movies"}
        subtitle="Real showtimes, real seat inventory — pick a film and preview your seat in 3D before paying."
      />

      <div className="flex flex-col gap-4 mb-8">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B4A6D4]" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies…"
            className="pl-9 bg-[#1A1029] border-white/10 focus-visible:ring-[#8B5CF6]"
            aria-label="Search movies"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-[#B4A6D4] mr-1 uppercase tracking-wider">Language</span>
          <FilterChip active={!lang} label="Any" onClick={() => setLang("")} />
          {LANGUAGES.map((l) => <FilterChip key={l} active={lang === l} label={l} onClick={() => setLang(l)} />)}
          <span className="text-xs text-[#B4A6D4] mr-1 ml-3 uppercase tracking-wider">Genre</span>
          <FilterChip active={!genre} label="Any" onClick={() => setGenre("")} />
          {GENRES.map((g) => <FilterChip key={g} active={genre === g} label={g} onClick={() => setGenre(g)} />)}
          <span className="text-xs text-[#B4A6D4] mr-1 ml-3 uppercase tracking-wider">Status</span>
          <FilterChip active={status === "NOW_SHOWING"} label="Now showing" onClick={() => setStatus("NOW_SHOWING")} />
          <FilterChip active={status === "UPCOMING"} label="Upcoming" onClick={() => setStatus("UPCOMING")} />
        </div>
      </div>

      {!movies && <Spinner label="Loading movies…" />}
      {movies && movies.length === 0 && (
        <EmptyState icon={<Film className="w-6 h-6" />} title="No movies match your filters" hint="Try clearing the search or switching language/genre." />
      )}
      {movies && movies.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {movies.map((m) => (
            <button
              key={m.id}
              onClick={() => navigate(`/movies/${m.slug || m.id}`)}
              className="cine-card cine-card-hover overflow-hidden text-left group cursor-pointer"
            >
              <div className="aspect-[2/3] overflow-hidden relative">
                { }
                <img src={m.posterUrl} alt={`${m.title} poster`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 backdrop-blur border border-white/10 text-[#F2B04C]">{m.certification}</span>
                {m.featured && status === "NOW_SHOWING" && (
                  <Badge className="absolute top-2 right-2 bg-[#F0659A] text-white border-0 text-[10px] px-1.5">FEATURED</Badge>
                )}
              </div>
              <div className="p-3">
                <div className="font-semibold text-sm truncate">{m.title}</div>
                <div className="text-xs text-[#B4A6D4] mt-0.5 truncate">{m.languages.join(", ")}</div>
                <div className="text-xs text-[#B4A6D4] mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" /> {m.durationMins} min · {m.genres.slice(0, 2).join(", ")}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`px-3 py-1.5 rounded-full text-xs border transition-colors cursor-pointer ${
        active ? "bg-[#8B5CF6] border-[#8B5CF6] text-white" : "border-white/10 text-[#B4A6D4] hover:border-[#8B5CF6]/50 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}
