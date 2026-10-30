"use client";
// Theatre detail: auditoriums + all upcoming shows.
import { useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api, fmtTime, fmtDate } from "@/lib/client";
import { PageTitle, EmptyState, Spinner } from "./bits";
import { MapPin, Armchair, Sparkles } from "lucide-react";

type Data = {
  theatre: { id: string; name: string; city: string; address: string; amenities: string[]; ownerName: string; auditoriums: { id: string; name: string; seatCount: number; geometrySource: string }[] };
  shows: {
    id: string; startsAt: string; format: string; language: string; auditorium: string;
    available: number; total: number;
    movie: { id: string; title: string; slug: string; posterUrl: string; durationMins: number; certification: string };
  }[];
};

export default function TheatreDetailView({ id }: { id: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api.get<Data>(`/api/theatres/${id}`).then(setData).catch(() => setNotFound(true));
  }, [id]);

  if (notFound) return <EmptyState title="Theatre not found" />;
  if (!data) return <div className="max-w-7xl mx-auto px-4 py-20"><Spinner label="Loading theatre…" /></div>;

  const days = [...new Set(data.shows.map((s) => s.startsAt.slice(0, 10)))].sort();

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <PageTitle title={data.theatre.name} subtitle={`${data.theatre.address} · operated by ${data.theatre.ownerName}`} />
      <div className="flex flex-wrap gap-1.5 mb-8">
        {data.theatre.amenities.map((a) => (
          <span key={a} className="text-[11px] px-2.5 py-1 rounded-md bg-[#477BFF]/10 border border-[#477BFF]/25 text-[#9FC0FF] flex items-center gap-1"><Sparkles className="w-3 h-3" />{a}</span>
        ))}
      </div>

      <section aria-label="Auditoriums" className="mb-12">
        <h2 className="text-xl font-bold mb-4">Auditoriums</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.theatre.auditoriums.map((a) => (
            <div key={a.id} className="cine-card p-5">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{a.name}</h3>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${a.geometrySource === "UPLOADED" ? "border-[#2FBF71]/40 text-[#2FBF71] bg-[#2FBF71]/10" : "border-white/15 text-[#8FA3BF] bg-white/5"}`}>
                  {a.geometrySource === "UPLOADED" ? "CALIBRATED MODEL" : "DEMO GEOMETRY"}
                </span>
              </div>
              <p className="text-sm text-[#8FA3BF] mt-2 flex items-center gap-1.5"><Armchair className="w-4 h-4" /> {a.seatCount} seats</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="All showtimes">
        <h2 className="text-xl font-bold mb-4">All showtimes</h2>
        {data.shows.length === 0 ? (
          <EmptyState title="No scheduled shows right now" hint="Shows appear here as soon as owners schedule them." />
        ) : (
          <div className="space-y-8">
            {days.map((d) => (
              <div key={d}>
                <h3 className="text-sm font-semibold text-[#20D9E8] uppercase tracking-wider mb-3">{fmtDate(d)}</h3>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {data.shows.filter((s) => s.startsAt.slice(0, 10) === d).map((s) => (
                    <button key={s.id} onClick={() => navigate(`/book/${s.id}`)} className="cine-card cine-card-hover p-4 flex gap-4 text-left cursor-pointer">
                      { }
                      <img src={s.movie.posterUrl} alt="" className="w-14 h-20 rounded-lg object-cover border border-white/10" loading="lazy" />
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate">{s.movie.title}</div>
                        <div className="text-xs text-[#8FA3BF] mt-0.5">{fmtTime(s.startsAt)} · {s.auditorium}</div>
                        <div className="text-xs text-[#20D9E8] mt-1">{s.format} · {s.language}</div>
                        <div className="text-[11px] text-[#8FA3BF] mt-1">{s.available}/{s.total} seats free</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
