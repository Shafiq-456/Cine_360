"use client";
// Theatre discovery with city filter.
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <PageTitle title="Theatres" subtitle="Browse CINE 360 partner theatres. Each auditorium has an independent 3D model and seating configuration." />
      <div className="flex flex-col md:flex-row gap-3 mb-8">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8FA3BF]" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or address…" className="pl-9 bg-[#101218] border-white/10" aria-label="Search theatres" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setCity("")} aria-pressed={!city} className={`px-3 py-2 rounded-lg text-xs border cursor-pointer transition-colors ${!city ? "bg-[#477BFF] border-[#477BFF] text-white" : "border-white/10 text-[#8FA3BF] hover:text-white"}`}>All cities</button>
          {cities.map((c) => (
            <button key={c} onClick={() => setCity(c)} aria-pressed={city === c} className={`px-3 py-2 rounded-lg text-xs border cursor-pointer transition-colors ${city === c ? "bg-[#477BFF] border-[#477BFF] text-white" : "border-white/10 text-[#8FA3BF] hover:text-white"}`}>{c}</button>
          ))}
        </div>
      </div>

      {!theatres && <Spinner label="Loading theatres…" />}
      {theatres && filtered.length === 0 && <EmptyState icon={<Building2 className="w-6 h-6" />} title="No theatres found" hint="Try another city or clear the search." />}
      <div className="grid md:grid-cols-2 gap-5">
        {filtered.map((t) => (
          <button key={t.id} onClick={() => navigate(`/theatres/${t.id}`)} className="cine-card cine-card-hover p-6 text-left cursor-pointer">
            <h3 className="font-semibold text-lg">{t.name}</h3>
            <p className="text-sm text-[#8FA3BF] mt-1 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {t.address}</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {t.amenities.slice(0, 4).map((a) => (
                <span key={a} className="text-[11px] px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[#B9C4D6]">{a}</span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {t.auditoriums.map((a) => (
                <span key={a.id} className="text-xs flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#477BFF]/10 border border-[#477BFF]/25 text-[#9FC0FF]">
                  <Armchair className="w-3.5 h-3.5" /> {a.name} · {a.seatCount} seats
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
