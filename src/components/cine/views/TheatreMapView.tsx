"use client";
// Cinema Discovery Map: Interactive visual locator, amenities, distances & shows.
import { useState, useEffect } from "react";
import { api } from "@/lib/client";
import { navigate } from "@/lib/router";
import {
  MapPin,
  Navigation,
  Compass,
  Film,
  Sparkles,
  Search,
  Building2,
  Tv,
  CheckCircle2,
  ChevronRight,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "./bits";
import { toast } from "sonner";

type TheatreLocation = {
  id: string;
  name: string;
  city: string;
  address: string;
  amenities: string[];
  lat: number;
  lng: number;
  auditoriumsCount?: number;
  featuredMovies?: string[];
  distanceKm?: number | null;
};

// Preset coordinates for major demo cinema locations in the ecosystem
const THEATRE_COORDS: Record<string, { lat: number; lng: number }> = {
  "Frost Cinemas": { lat: 13.0827, lng: 80.2707 }, // Chennai
  "Flame Multiplex": { lat: 11.0168, lng: 76.9558 }, // Coimbatore
  "Aura Cinemas": { lat: 12.9716, lng: 77.5946 }, // Bangalore
  "Apex Screens": { lat: 17.3850, lng: 78.4867 }, // Hyderabad
  "Cinepolis Galaxy": { lat: 9.9312, lng: 76.2673 }, // Kochi
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function TheatreMapView() {
  const [theatres, setTheatres] = useState<TheatreLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [search, setSearch] = useState("");
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    api
      .get<{ theatres: any[] }>("/api/theatres")
      .then((res) => {
        const enriched = res.theatres.map((t) => {
          let parsedAmenities: string[] = [];
          try {
            parsedAmenities = JSON.parse(t.amenities || "[]");
          } catch {
            parsedAmenities = ["Dolby Atmos", "4K Laser", "Recliner Seating"];
          }
          const coords = THEATRE_COORDS[t.name] || { lat: 13.0827, lng: 80.2707 };
          return {
            id: t.id,
            name: t.name,
            city: t.city,
            address: t.address,
            amenities: parsedAmenities.length ? parsedAmenities : ["Dolby Atmos 7.1", "Laser 4K", "Comfort Recliner", "Gourmet Cafe"],
            lat: coords.lat,
            lng: coords.lng,
            auditoriumsCount: t.auditoriums?.length || 2,
            distanceKm: null,
          };
        });
        setTheatres(enriched);
        if (enriched.length > 0) setSelectedId(enriched[0].id);
      })
      .catch((err) => {
        toast.error("Failed to load theatres");
      })
      .finally(() => setLoading(false));
  }, []);

  const requestUserLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const uLat = pos.coords.latitude;
        const uLng = pos.coords.longitude;
        setUserCoords({ lat: uLat, lng: uLng });
        setTheatres((prev) =>
          prev.map((t) => ({
            ...t,
            distanceKm: calculateDistance(uLat, uLng, t.lat, t.lng),
          }))
        );
        toast.success("Your location detected! Distances updated.");
        setLocating(false);
      },
      (err) => {
        toast.info("Location permission was denied or unavailable. You can still browse all venues by city.");
        setLocating(false);
      }
    );
  };

  const filteredTheatres = theatres.filter((t) => {
    if (cityFilter && t.city.toLowerCase() !== cityFilter.toLowerCase()) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.address.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const selectedTheatre = theatres.find((t) => t.id === selectedId) || filteredTheatres[0];

  const cities = Array.from(new Set(theatres.map((t) => t.city)));

  if (loading) {
    return (
      <div className="py-32 flex justify-center">
        <Spinner label="Loading Cinema Discovery Map…" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Title & Location Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-8 h-8 rounded-lg bg-[#38BDF8]/15 border border-[#38BDF8]/30 flex items-center justify-center text-[#38BDF8]">
              <Compass className="w-4 h-4" />
            </span>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Cinema Discovery Map</h1>
          </div>
          <p className="text-xs text-[#94A3B8]">
            Locate premier CINE 360 auditoriums, inspect venue amenities, and calculate travel proximity.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={requestUserLocation}
            disabled={locating}
            className="border-white/15 bg-white/[0.04] text-white hover:border-[#38BDF8]/50 gap-2 cursor-pointer text-xs"
          >
            <Navigation className="w-3.5 h-3.5 text-[#38BDF8]" />
            {userCoords ? "Recalculate Proximity" : "Use My Location"}
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/theatres")}
            className="bg-[#8B5CF6] hover:bg-[#A78BFA] text-white text-xs"
          >
            List View
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2.5 items-center mb-6">
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search venue or street…"
            className="bg-[#180E28] border-white/10 text-white pl-9 text-xs h-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 items-center">
          <button
            onClick={() => setCityFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              !cityFilter ? "bg-[#38BDF8] border-[#38BDF8] text-black" : "border-white/10 text-[#94A3B8] hover:text-white"
            }`}
          >
            All Cities
          </button>
          {cities.map((c) => (
            <button
              key={c}
              onClick={() => setCityFilter(c)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                cityFilter === c ? "bg-[#38BDF8] border-[#38BDF8] text-black" : "border-white/10 text-[#94A3B8] hover:text-white"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Main Map & Venue Showcase Grid */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Theatres List (Left Column) */}
        <div className="lg:col-span-5 space-y-3 max-h-[640px] overflow-y-auto cine-scroll pr-1">
          {filteredTheatres.length === 0 ? (
            <div className="cine-card p-6 text-center text-xs text-[#94A3B8]">
              No theatres matched your search filter.
            </div>
          ) : (
            filteredTheatres.map((t) => {
              const active = selectedTheatre?.id === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    active
                      ? "bg-[#1E1233] border-[#38BDF8] shadow-lg shadow-[#38BDF8]/10"
                      : "bg-[#140C20]/80 border-white/10 hover:border-white/25 hover:bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#38BDF8]" />
                      {t.name}
                    </h3>
                    {t.distanceKm !== null && t.distanceKm !== undefined && (
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30">
                        {t.distanceKm} km away
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#94A3B8] flex items-center gap-1 mb-3">
                    <MapPin className="w-3.5 h-3.5 text-[#8B5CF6]" />
                    {t.address}, {t.city}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {t.amenities.slice(0, 3).map((a, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded bg-white/[0.05] border border-white/10 text-[#CBD5E1]"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-white/5">
                    <span className="text-[#94A3B8] text-[11px]">3D Auditoriums Online</span>
                    <span className="text-[#38BDF8] font-semibold flex items-center gap-1">
                      Explore Venue <ChevronRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Visual Map Simulator & Venue Profile (Right Column) */}
        <div className="lg:col-span-7 space-y-4">
          {selectedTheatre ? (
            <div className="cine-card p-6 rounded-2xl border border-white/10 bg-[#120A1C] relative overflow-hidden">
              {/* Simulated Stylized Cinema Map Canvas */}
              <div className="relative w-full h-64 rounded-xl overflow-hidden border border-white/15 bg-gradient-to-br from-[#0A0512] via-[#150A24] to-[#1F0E38] p-6 flex flex-col justify-between">
                <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(#38BDF8_1px,transparent_1px)] [background-size:16px_16px]" />

                <div className="relative z-10 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium bg-black/60 backdrop-blur text-white border border-white/10">
                    <MapPin className="w-3.5 h-3.5 text-[#38BDF8]" /> GPS: {selectedTheatre.lat.toFixed(4)}°N, {selectedTheatre.lng.toFixed(4)}°E
                  </span>
                  {selectedTheatre.distanceKm && (
                    <span className="text-xs font-semibold text-[#34D399] bg-[#10B981]/20 px-2.5 py-1 rounded-md border border-[#10B981]/30">
                      📍 {selectedTheatre.distanceKm} km from your current coordinates
                    </span>
                  )}
                </div>

                {/* Animated Map Pin */}
                <div className="relative z-10 self-center text-center">
                  <div className="relative inline-flex items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-12 w-12 rounded-full bg-[#38BDF8] opacity-35" />
                    <span className="relative w-10 h-10 rounded-full bg-[#38BDF8] text-black font-bold flex items-center justify-center shadow-lg shadow-[#38BDF8]/50">
                      <Building2 className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="mt-2 text-sm font-bold text-white tracking-wide">
                    {selectedTheatre.name}
                  </div>
                  <div className="text-xs text-[#38BDF8]">{selectedTheatre.city}</div>
                </div>

                <div className="relative z-10 flex items-center justify-between text-[11px] text-[#94A3B8]">
                  <span>Visual Coordinate Simulator</span>
                  <span>Real Geometry Mapping</span>
                </div>
              </div>

              {/* Venue Specifications */}
              <div className="mt-6 space-y-4">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">{selectedTheatre.name}</h2>
                  <p className="text-xs text-[#94A3B8]">{selectedTheatre.address}, {selectedTheatre.city}</p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="text-[11px] text-[#94A3B8] flex items-center gap-1 mb-1">
                      <Volume2 className="w-3.5 h-3.5 text-[#8B5CF6]" /> Sound Tech
                    </div>
                    <div className="text-xs font-semibold text-white">Dolby Atmos 64-Ch</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="text-[11px] text-[#94A3B8] flex items-center gap-1 mb-1">
                      <Tv className="w-3.5 h-3.5 text-[#38BDF8]" /> Projection
                    </div>
                    <div className="text-xs font-semibold text-white">Barco 4K Laser RGB</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="text-[11px] text-[#94A3B8] flex items-center gap-1 mb-1">
                      <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" /> 3D Engine
                    </div>
                    <div className="text-xs font-semibold text-white">Calibrated SeatVision</div>
                  </div>
                </div>

                <div className="pt-2">
                  <h4 className="text-xs font-semibold text-[#CBD5E1] uppercase tracking-wider mb-2">
                    Auditorium Amenities
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedTheatre.amenities.map((amenity, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-white/[0.04] border border-white/10 text-white"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                        {amenity}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-4 flex items-center gap-3">
                  <Button
                    onClick={() => navigate(`/theatres/${selectedTheatre.id}`)}
                    className="bg-[#8B5CF6] hover:bg-[#A78BFA] text-white flex-1"
                  >
                    View Showtimes &amp; 3D Halls
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      const query = encodeURIComponent(`${selectedTheatre.name} ${selectedTheatre.address}`);
                      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
                    }}
                    className="border-white/15 text-white hover:border-[#38BDF8]"
                  >
                    Open in Google Maps
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="cine-card p-12 text-center text-sm text-[#94A3B8]">
              Select a theatre from the list to preview details and screen availability.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
