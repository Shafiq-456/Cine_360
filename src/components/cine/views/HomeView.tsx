"use client";
// CINE 360 home — Obsidian Amber Cinema landing page with motion throughout.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { navigate } from "@/lib/router";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Armchair, Eye, Scan, Sparkles, PlayCircle, MapPin, ArrowRight, Ticket, ScanLine, QrCode, Hourglass } from "lucide-react";
import type { Movie } from "@/components/cine/views/MoviesView";
import { Reveal, RevealItem, Ticker } from "@/components/cine/anim";

const HERO_WORDS = ["Experience", "Your", "Seat"];

type HomeData = {
  featured: Movie[];
  nowShowing: Movie[];
  upcoming: Movie[];
  cities: { name: string; theatres: number; screens: number }[];
  theatres: { id: string; name: string; city: string; auditoriums: number }[];
};

function MovieRail({ title, subtitle, movies, seeAll }: { title: string; subtitle: string; movies: Movie[]; seeAll: string }) {
  if (movies.length === 0) return null;
  return (
    <section className="mt-16" aria-label={title}>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
          <p className="text-sm text-[#94A3B8] mt-1">{subtitle}</p>
        </div>
        <Button variant="ghost" size="sm" className="text-[#F59E0B] hover:text-[#FBBF24]" onClick={() => navigate(seeAll)}>
          View all <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {movies.slice(0, 5).map((m, i) => (
          <motion.button
            key={m.id}
            initial={{ opacity: 0, y: 26 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6 }}
            onClick={() => navigate(`/movies/${m.slug || m.id}`)}
            className="cine-card cine-card-hover overflow-hidden text-left group cursor-pointer"
          >
            <div className="aspect-[2/3] overflow-hidden relative">
              <img src={m.posterUrl} alt={`${m.title} poster`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" loading="lazy" />
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-black/75 backdrop-blur border border-white/10 text-[#FBBF24]">
                {m.certification}
              </span>
              <span className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#38BDF8] opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
            </div>
            <div className="p-3">
              <div className="font-semibold text-sm truncate">{m.title}</div>
              <div className="text-xs text-[#94A3B8] mt-0.5 truncate">{m.genres.slice(0, 2).join(" · ")} · {m.durationMins} min</div>
            </div>
          </motion.button>
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
          api.get<{ theatres: { id: string; name: string; city: string; auditoriums: unknown[] }[] }>("/api/theatres"),
        ]);
        const cityMap = new Map<string, { theatres: number; screens: number }>();
        for (const t of theatres.theatres) {
          const c = cityMap.get(t.city) || { theatres: 0, screens: 0 };
          c.theatres += 1;
          c.screens += Array.isArray(t.auditoriums) ? t.auditoriums.length : 0;
          cityMap.set(t.city, c);
        }
        setData({
          featured: movies.movies.filter((m) => m.featured && m.status === "NOW_SHOWING"),
          nowShowing: movies.movies.filter((m) => m.status === "NOW_SHOWING"),
          upcoming: movies.movies.filter((m) => m.status === "UPCOMING"),
          cities: [...cityMap.entries()].map(([name, c]) => ({ name, ...c })).sort((a, b) => b.theatres - a.theatres || a.name.localeCompare(b.name)),
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
        <div className="cine-aurora" aria-hidden="true" />
        <div className="cine-ember" aria-hidden="true" />
        <div className="cine-film-grain" aria-hidden="true" />
        <div className="relative max-w-7xl mx-auto px-4 pt-20 pb-24 md:pt-28 md:pb-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#F59E0B]/35 bg-[#F59E0B]/10 text-[#FBBF24] text-xs font-medium mb-8 cine-float">
              <Sparkles className="w-3.5 h-3.5" /> 3D-first cinema booking · Real seat inventory
            </div>
            <h1 className="text-4xl md:text-6xl font-bold leading-[1.08] tracking-tight">
              {HERO_WORDS.map((w, i) => (
                <motion.span
                  key={w}
                  className="inline-block mr-3"
                  initial={{ opacity: 0, y: 34, rotateX: 40 }}
                  animate={{ opacity: 1, y: 0, rotateX: 0 }}
                  transition={{ duration: 0.7, delay: 0.12 * i, ease: [0.22, 1, 0.36, 1] }}
                >
                  {w}
                </motion.span>
              ))}
              <motion.span
                className="cine-gradient-text inline-block"
                initial={{ opacity: 0, y: 34 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                Before You Book.
              </motion.span>
            </h1>
            <motion.p
              className="mt-6 text-[#94A3B8] text-base md:text-lg leading-relaxed max-w-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              Step into virtual 3D cinema auditoriums, explore every row, preview your exact viewing perspective and book with confidence.
            </motion.p>
            <motion.div
              className="mt-10 flex flex-wrap gap-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.62 }}
            >
              <Button
                size="lg"
                className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#FBBF24] hover:to-[#F59E0B] text-slate-950 font-bold tracking-wide cine-glow-amber cine-sheen px-7 shadow-lg shadow-amber-500/20 cursor-pointer"
                onClick={() => {
                  const first = data?.featured?.[0] || data?.nowShowing?.[0];
                  if (first) navigate(`/movies/${first.slug || first.id}`);
                  else navigate("/movies");
                }}
              >
                <Armchair className="w-4 h-4 mr-2" /> ENTER 3D CINEMA EXPERIENCE
              </Button>
              <Button size="lg" variant="outline" className="border-white/15 hover:border-[#F59E0B]/50 hover:text-[#FBBF24] text-[#E2E8F0] px-7 font-semibold tracking-wide cursor-pointer" onClick={() => navigate("/movies")}>
                <PlayCircle className="w-4 h-4 mr-2" /> EXPLORE ALL MOVIES
              </Button>
            </motion.div>
            <motion.div
              className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-xs text-[#94A3B8]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.78 }}
            >
              <span className="flex items-center gap-2"><Eye className="w-3.5 h-3.5 text-[#F59E0B]" /> Seat Experience Mode — see the screen from your seat</span>
              <span className="flex items-center gap-2"><Scan className="w-3.5 h-3.5 text-[#FBBF24]" /> SeatVision geometry measurements</span>
              <span className="flex items-center gap-2"><Hourglass className="w-3.5 h-3.5 text-[#38BDF8]" /> 5-minute protected seat holds</span>
            </motion.div>
          </div>
        </div>
        {/* "now showing" marquee ticker along the hero floor */}
        {data && (
          <div className="relative border-t border-white/5 bg-[#090C12]/80 py-3">
            <Ticker
              items={[
                ...data.nowShowing.slice(0, 12).map((m) => m.title),
                ...data.cities.map((c) => `Now in ${c.name}`),
              ]}
            />
          </div>
        )}
        {/* decorative "screen" glow at the bottom like an auditorium screen */}
        <div className="absolute bottom-0 inset-x-0 h-24 cine-screen-arc opacity-[0.06]" aria-hidden="true" />
      </section>

      <div className="max-w-7xl mx-auto px-4 pb-24">
        {/* ================= HOW IT WORKS ================= */}
        <Reveal className="mt-16 grid md:grid-cols-3 gap-4" >
          {[ 
            { icon: <Armchair className="w-5 h-5" />, color: "#F59E0B", title: "1 · Enter the auditorium", text: "Walk the rows in 3D or orbit the hall. Every chair is a real, bookable seat." },
            { icon: <Eye className="w-5 h-5" />, color: "#FBBF24", title: "2 · Preview your view", text: "Sit virtually at the exact eye position and measure distance, angles and sightlines." },
            { icon: <Ticket className="w-5 h-5" />, color: "#38BDF8", title: "3 · Hold, pay, go", text: "Seats are held for 5 minutes while you check out. QR tickets at the gate." },
          ].map((s) => (
            <RevealItem key={s.title}>
              <div className="cine-card cine-card-hover p-6 h-full">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ background: `${s.color}1A`, color: s.color }}>
                  {s.icon}
                </div>
                <h3 className="font-semibold mb-1.5">{s.title}</h3>
                <p className="text-sm text-[#94A3B8] leading-relaxed">{s.text}</p>
              </div>
            </RevealItem>
          ))}
        </Reveal>

        {/* ================= RAILS ================= */}
        {!data && !error && (
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="aspect-[2/3] rounded-xl bg-[#141722]" />)}
          </div>
        )}
        {error && (
          <div className="mt-16 text-center text-[#94A3B8]">Could not load the catalogue. Please refresh the page.</div>
        )}
        {data && (
          <>
            <MovieRail title="Featured this week" subtitle="Hand-picked screenings now playing" movies={data.featured.length ? data.featured : data.nowShowing} seeAll="/movies" />
            <MovieRail title="Now showing" subtitle="All films currently on screens" movies={data.nowShowing} seeAll="/movies" />
            <MovieRail title="Upcoming releases" subtitle="Coming soon to CINE 360 theatres" movies={data.upcoming} seeAll="/movies?status=UPCOMING" />
          </>
        )}

        {/* ================= CITIES ================= */}
        {data && data.cities.length > 0 && (
          <section className="mt-16" aria-label="Browse by city">
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Browse by city</h2>
                <p className="text-sm text-[#94A3B8] mt-1">CINE 360 now screens in {data.cities.length} cities — pick yours and choose a hall</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[#F59E0B] hover:text-[#FBBF24]" onClick={() => navigate("/theatres")}>
                All theatres <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {data.cities.map((c) => (
                <motion.button
                  key={c.name}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ y: -4 }}
                  onClick={() => navigate(`/theatres?city=${encodeURIComponent(c.name)}`)}
                  className="cine-card cine-card-hover p-5 text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="w-4 h-4 text-[#F59E0B]" />
                    <h3 className="font-semibold group-hover:text-[#FBBF24] transition-colors">{c.name}</h3>
                  </div>
                  <p className="text-xs text-[#94A3B8]">{c.theatres} theatre{c.theatres === 1 ? "" : "s"} · {c.screens} screen{c.screens === 1 ? "" : "s"}</p>
                </motion.button>
              ))}
            </div>
          </section>
        )}

        {/* ================= THEATRES ================= */}
        {data && data.theatres.length > 0 && (
          <section className="mt-16" aria-label="Popular theatres">
            <div className="flex items-end justify-between mb-5">
              <div>
                <h2 className="text-xl md:text-2xl font-bold">Popular theatres</h2>
                <p className="text-sm text-[#94A3B8] mt-1">Multiple auditoriums, each with its own 3D model and seating map</p>
              </div>
              <Button variant="ghost" size="sm" className="text-[#F59E0B] hover:text-[#FBBF24]" onClick={() => navigate("/theatres")}>
                All theatres <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.theatres.map((t) => (
                <button key={t.id} onClick={() => navigate(`/theatres/${t.id}`)} className="cine-card cine-card-hover p-6 text-left cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold">{t.name}</h3>
                      <p className="text-sm text-[#94A3B8] mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {t.city}</p>
                    </div>
                    <span className="text-xs text-[#FBBF24] border border-[#F59E0B]/30 bg-[#F59E0B]/10 rounded-full px-2.5 py-1">
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
            <h2 className="text-lg font-bold flex items-center gap-2"><QrCode className="w-5 h-5 text-[#F59E0B]" /> Try the full journey — staff scanner included</h2>
            <p className="text-sm text-[#94A3B8] mt-2 leading-relaxed">
              Book seats in 3D, complete the clearly-labelled <span className="text-[#FBBF24] font-medium">TEST MODE</span> payment, get a QR ticket, then validate it at the gate with the demo staff account. All demo roles use one shared password shown on the sign-in page.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <Button variant="outline" className="border-white/15 hover:border-[#F59E0B]/50 hover:text-[#FBBF24]" onClick={() => navigate("/login")}>
              <ScanLine className="w-4 h-4 mr-2" /> Demo accounts
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
