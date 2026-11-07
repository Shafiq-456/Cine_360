"use client";
// Theatre discovery with city filter — theatres are grouped under their city
// when browsing all cities, and filterable to a single city via the chips
// (deep-linkable via /theatres?city=Bengaluru).
import { useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api } from "@/lib/client";
import { Input } from "@/components/ui/input";
import { PageTitle, EmptyState, Spinner } from "./bits";
import { Search, MapPin, Armchair, Building2 } from "lucide-react";

type Theatre = {
  id: string; name: string; city: string; address: string;
  amenities: string[];
  auditoriums: { id: string; name: string; geometrySource: string; seatCount: number }[];
};

export default function TheatresView({ params }: { params: URLSearchParams }) {
  const [theatres, setTheatres] = useState<Theatre[] | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [city, setCity] = useState(params.get("city") || "");
  const [q, setQ] = useState("");

  useEffect(() => {
    api
      .get<{ cities: string[]; theatres: Theatre[] }>("/api/theatres")
      .then((d) => {
        setCities(d.cities);
        setTheatres(d.theatres);
      })
      .catch(() => setTheatres([]));
  }, []);

  const filtered = (theatres || []).filter(
    (t) =>
      (!city || t.city === city) &&
      (!q.trim() || (t.name + t.city + t.address).toLowerCase().includes(q.toLowerCase()))
  );

  // Group by city so "the theatres in the cities" are always visible together.
  const grouped = filtered.reduce<Record<string, Theatre[]>>((acc, t) => {
    (acc[t.city] ||= []).push(t);
    return acc;
  }, {});
  const groupNames = Object.keys(grouped).sort();
  const countIn = (c: string) => (theatres || []).filter((t) => t.city === c).length;

  const theatreCard = (t: Theatre) => (
    <button key={t.id} onClick={() => navigate(`/theatres/${t.id}`)} className="cine-card cine-card-hover p-6 text-left cursor-pointer">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-lg">{t.name}</h3>
        <span className="shrink-0 text-[11px] px-2 py-1 rounded-md bg-[#F2B04C]/10 border border-[#F2B04C]/30 text-[#A9741A] flex items-center gap-1">
          <MapPin className="w-3 h-3" /> {t.city}
        </span>
      </div>
      <p className="text-sm text-[#B4A6D4] mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" /> {t.address}</p>
      <div className="flex flex-wrap gap-1.5 mt-3">
        {t.amenities.slice(0, 4).map((a) => (
          <span key={a} className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[#D5C9F0]">{a}</span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {t.auditoriums.map((a) => (
          <span key={a.id} className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#8B5CF6]/10 border border-[#8B5CF6]/25 text-[#C4B5FD]">
            <Armchair className="w-3.5 h-3.5" /> {a.name} · {a.seatCount} seats
          </span>
        ))}
      </div>
    </button>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <PageTitle title="Theatres" subtitle="Browse CINE 360 partner theatres by city. Each auditorium has an independent 3D model and seating configuration." />
      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#B4A6D4]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or address…" className="pl-9 bg-[#1A1029] border-white/10" aria-label="Search theatres" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCity("")} aria-pressed={!city} className={`px-3 py-2 rounded-lg text-xs border cursor-pointer transition-colors ${!city ? "bg-[#8B5CF6] border-[#8B5CF6] text-white" : "border-white/10 text-[#B4A6D4] hover:text-white"}`}>All cities</button>
          {cities.map((c) => (
            <button key={c} onClick={() => setCity(c)} aria-pressed={city === c} className={`px-3 py-2 rounded-lg text-xs border cursor-pointer transition-colors ${city === c ? "bg-[#8B5CF6] border-[#8B5CF6] text-white" : "border-white/10 text-[#B4A6D4] hover:text-white"}`}>
              {c} ({countIn(c)})
            </button>
          ))}
        </div>
      </div>

      {!theatres && <Spinner label="Loading theatres…" />}
      {theatres && filtered.length === 0 && <EmptyState icon={<Building2 className="w-6 h-6" />} title="No theatres found" hint="Try another city or clear the search." />}

      {theatres && filtered.length > 0 && (
        <div>
          {groupNames.map((c) => (
            <section key={c} className="mb-10" aria-label={`${c} theatres`}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2"><MapPin className="w-4 h-4 text-[#F2B04C]" /> {c}</h2>
                <span className="text-xs text-[#B4A6D4] border border-white/10 rounded-full px-2.5 py-1">
                  {grouped[c].length} theatre{grouped[c].length === 1 ? "" : "s"} · {grouped[c].reduce((n, t) => n + t.auditoriums.length, 0)} auditorium{grouped[c].reduce((n, t) => n + t.auditoriums.length, 0) === 1 ? "" : "s"}
                </span>
                <div className="flex-1 h-px bg-white/10" aria-hidden="true" />
              </div>
              <div className="grid md:grid-cols-2 gap-5">
                {grouped[c].map(theatreCard)}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
