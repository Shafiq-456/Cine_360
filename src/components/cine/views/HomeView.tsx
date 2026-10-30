"use client";
// CINE 360 home — premium cinematic landing page.
import { useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Armchair, Eye, Scan, Sparkles, PlayCircle, MapPin, ArrowRight, Ticket, ScanLine, QrCode, Hourglass } from "lucide-react";
import type { Movie } from "@/components/cine/views/MoviesView";

type HomeData = {
  featured: Movie[];
  nowShowing: Movie[];
  upcoming: Movie[];
  theatres: { id: string; name: string; city: string; auditoriums: number }[];
};

function MovieRail({ title, subtitle, movies, seeAll }: { title: string; subtitle: string; movies: Movie[]; seeAll: string }) {
  if (movies.length === 0) return null;
  return (
    <section className="mt-16" aria-label={title}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
          <p className="text-sm text-[#8FA3BF] mt-1">{subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" className="text-[#477BFF] hover:text-[#9FC0FF]" onClick={() => navigate(seeAll)}>
          View all <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {movies.slice(0, 5).map((m) => (
          <button
            key={m.id}
            onClick={() => navigate(`/movies/${m.slug || m.id}`)}
            className="cine-card cine-card-hover overflow-hidden text-left group cursor-pointer"
          >
            <div className="aspect-[2/3] overflow-hidden relative">
              { }
              <img src={m.posterUrl} alt={`${m.title} poster`} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/60 backdrop-blur border border-white/10 text-[#20D9E8]">
                {m.certification}
              </span>
            </div>
            <div className="p-3">
              <div className="font-semibold text-sm truncate">{m.title}</div>
              <div className="text-xs text-[#8FA3BF] mt-0.5 truncate">{m.genres.slice(0, 2).join(" · ")} · {m.durationMins} min</div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function HomeView() {
  const [data, setData] = useState<HomeData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [movies, theatres] = await Promise.all([
          api.get<{ movies: Movie[] }>("/api/movies"),
          api.get<{ theatres: HomeData["theatres"] }>("/api/theatres"),
        ]);
        setData({
          featured: movies.movies.filter((m) => m.featured && m.status === "NOW_SHOWING"),
          nowShowing: movies.movies.filter((m) => m.status === "NOW_SHOWING"),
          upcoming: movies.movies.filter((m) => m.status === "UPCOMING"),
          theatres: theatres.theatres.map((t) => ({ id: t.id, name: t.name, city: t.city, auditoriums: t.auditoriums?.length ?? 0 })),
        });
      } catch {
        setError(true);
      }
    })();
  }, []);

  return (
    <div>
      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="cine-hero-beam" aria-hidden="true" />
        <div className="cine-film-grain" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#477BFF]/30 bg-[#477BFF]/10 text-[#9FC0FF] text-xs font-medium mb-8">
              <Sparkles className="w-3.5 h-3.5" /> 3D-first cinema booking · Real seat inventory
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.08] tracking-tight">
              Experience Your Seat <span className="cine-gradient-text">Before You Book.</span>
            </h1>
            <p className="mt-6 text-[#8FA3BF] text-base md:text-lg leading-relaxed max-w-2xl">
              Step into virtual 3D cinema auditoriums, explore every row, preview your exact viewing perspective and book with confidence.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Button
                size="lg"
                className="bg-[#477BFF] hover:bg-[#5C89FF] text-white font-semibold tracking-wide cine-glow-blue px-7"
                onClick={() => {
                  const first = data?.featured?.[0] || data?.nowShowing?.[0];
                  if (first) navigate(`/movies/${first.slug || first.id}`);
                  else navigate("/movies");
                }}
              >
                <Armchair className="w-4 h-4 mr-2" /> ENTER 3D CINEMA EXPERIENCE
              </Button>
              <Button size="lg" variant="outline" className="border-[#DDE1E8]/20 hover:border-[#20D9E8]/50 hover:text-[#20D9E8] px-7 font-semibold tracking-wide" onClick={() => navigate("/movies")}>
                <PlayCircle className="w-4 h-4 mr-2" /> EXPLORE ALL MOVIES
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-xs text-[#8FA3BF]">
              <span className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-[#477BFF]" /> Seat Experience Mode — see the screen from your seat</span>
              <span className="flex items-center gap-2"><Scan className="w-3.5 h-3.5 text-[#20D9E8]" /> SeatVision geometry measurements</span>
              <span className="flex items-center gap-2"><Hourglass className="w-3.5 h-3.5 text-[#FF713D]" /> 5-minute protected seat holds</span>
            </div>
          </div>
        </div>
        {/* decorative "screen" glow at the bottom like an auditorium screen */}
        <div className="absolute bottom-0 inset-x-0 h-24 cine-screen-arc opacity-[0.06]" aria-hidden="true" />
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-24">
        {/* ================= HOW IT WORKS ================= */}
        <section className="mt-16 grid md:grid-cols-3 gap-4" aria-label="How CINE 360 works">
          {[
            { icon: <Armchair className="w-5 h-5" />, color: "#477BFF", title: "1 · Enter the auditorium", text: "Walk the rows in 3D or orbit the hall. Every chair is a real, bookable seat." },
            { icon: <Eye className="w-5 h-5" />, color: "#20D9E8", title: "2 · Preview your view", text: "Sit virtually at the exact eye position and measure distance, angles and sightlines." },
            { icon: <Ticket className="w-5 h-5" />, color: "#FF713D", title: "3 · Hold, pay, go", text: "Seats are held for 5 minutes while you check out. QR tickets at the gate." },
          ].map((s) => (
            <div key={s.title} className="cine-card p-6">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${s.color}1A`, color: s.color }}>
                {s.icon}
              </div>
              <h3 className="font-semibold mb-1.5">{s.title}</h3>
              <p className="text-sm text-[#8FA3BF] leading-relaxed">{s.text}</p>
            </div>
          ))}
        </section>

        {/* ================= RAILS ================= */}
        {!data && !error && (
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-xl bg-[#171A21]" />)}
          </div>
        )}
        {error && (
          <div className="mt-16 text-center text-[#8FA3BF]">Could not load the catalogue. Please refresh the page.</div>
        )}
        {data && (
          <>
            <MovieRail title="Featured this week" subtitle="Hand-picked screenings now playing" movies={data.featured.length ? data.featured : data.nowShowing} seeAll="/movies" />
            <MovieRail title="Now showing" subtitle="All films currently on screens" movies={data.nowShowing} seeAll="/movies" />
            <MovieRail title="Upcoming releases" subtitle="Coming soon to CINE 360 theatres" movies={data.upcoming} seeAll="/movies?status=UPCOMING" />
          </>
        )}

        {/* ================= THEATRES ================= */}
        {data && data.theatres.length > 0 && (
          <section className="mt-16" aria-label="Popular theatres">
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Popular theatres</h2>
                <p className="text-sm text-[#8FA3BF] mt-1">Multiple auditoriums, each with its own 3D model and seating map</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[#477BFF] hover:text-[#9FC0FF]" onClick={() => navigate("/theatres")}>
                All theatres <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              {data.theatres.map((t) => (
                <button key={t.id} onClick={() => navigate(`/theatres/${t.id}`)} className="cine-card cine-card-hover p-6 text-left cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="text-sm text-[#8FA3BF] mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {t.city}</p>
                    </div>
                    <span className="text-xs text-[#20D9E8] border border-[#20D9E8]/30 bg-[#20D9E8]/10 rounded-full px-2.5 py-1">
                      {t.auditoriums} auditorium{t.auditoriums === 1 ? "" : "s"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ================= DEMO NOTE ================= */}
        <section className="mt-16 cine-card p-6 md:p-8 flex flex-col md:flex-row md:items-center gap-6 justify-between" aria-label="Demo access">
          <div className="max-w-xl">
            <h2 className="text-lg font-bold flex items-center gap-2"><QrCode className="w-5 h-5 text-[#FF713D]" /> Try the full journey — staff scanner included</h2>
            <p className="text-sm text-[#8FA3BF] mt-2 leading-relaxed">
              Book seats in 3D, complete the clearly-labelled <span className="text-[#F5C518]">TEST MODE</span> payment, get a QR ticket, then validate it at the gate with the demo staff account. All demo roles use one shared password shown on the sign-in page.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" className="border-white/15 hover:border-[#477BFF]/50" onClick={() => navigate("/login")}>
              <ScanLine className="w-4 h-4 mr-2" /> Demo accounts
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
