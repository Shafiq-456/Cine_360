"use client";
// Owner: showtime scheduling + bookings list (mode = "shows" | "bookings").
import { useCallback, useEffect, useState } from "react";
import { api, inr, fmtDateTime } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge, Spinner, EmptyState } from "../bits";
import { toast } from "sonner";
import { Plus, CalendarOff, Ticket } from "lucide-react";

type ShowRow = {
  id: string; startsAt: string; format: string; language: string;
  movie: { title: string; posterUrl: string };
  auditorium: { name: string; theatre: { name: string; city: string } };
  total: number; available: number; held: number; booked: number;
};
type BookingRow = {
  id: string; reference: string; status: string; totalAmount: number; createdAt: string;
  user: { name: string; email: string };
  seats: { rowLabel: string; seatNumber: number }[];
  payment?: { status: string; provider: string; method?: string } | null;
  show: { startsAt: string; movie: { title: string }; auditorium: { name: string; theatre: { name: string } } };
};
type AuditoriumOpt = { id: string; name: string; theatre: { name: string }; layoutConfig: string; _count?: { seats: number } };
type MovieOpt = { id: string; title: string; durationMins: number; languages: string[]; status: string };

export default function OwnerShows({ mode }: { mode: "shows" | "bookings" }) {
  return mode === "shows" ? <Shows /> : <Bookings />;
}

function Shows() {
  const [shows, setShows] = useState<ShowRow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [auditoriums, setAuditoriums] = useState<AuditoriumOpt[]>([]);
  const [movies, setMovies] = useState<MovieOpt[]>([]);
  const [form, setForm] = useState({ auditoriumId: "", movieId: "", date: "", time: "18:30", format: "2D", language: "" });
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<{ shows: ShowRow[] }>("/api/owner/shows").then((d) => setShows(d.shows)).catch(() => setShows([]));
  }, []);

  useEffect(() => {
    load();
    api.get<{ auditoriums: AuditoriumOpt[] }>("/api/owner/auditoriums").then((d) => setAuditoriums(d.auditoriums)).catch(() => {});
    api.get<{ movies: MovieOpt[] }>("/api/movies?status=NOW_SHOWING").then((d) => setMovies(d.movies)).catch(() => {});
  }, [load]);

  const selectedAud = auditoriums.find((a) => a.id === form.auditoriumId);
  const selectedMovie = movies.find((m) => m.id === form.movieId);
  const categories: string[] = selectedAud ? [...new Set((JSON.parse(selectedAud.layoutConfig).rows as { categoryCode: string }[]).map((r) => r.categoryCode))] : [];

  const create = async () => {
    setBusy(true);
    try {
      const startsAt = new Date(`${form.date}T${form.time}:00`);
      await api.post("/api/owner/shows", {
        auditoriumId: form.auditoriumId,
        movieId: form.movieId,
        startsAt: startsAt.toISOString(),
        language: form.language || selectedMovie?.languages[0] || "English",
        format: form.format,
        priceOverrides: Object.fromEntries(Object.entries(priceOverrides).filter(([, v]) => v !== "").map(([k, v]) => [k, Number(v)])),
      });
      toast.success("Show scheduled with full seat inventory.");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule show");
    } finally {
      setBusy(false);
    }
  };

  const cancelShow = async (id: string) => {
    try {
      await api.patch(`/api/owner/shows/${id}`, { status: "CANCELLED" });
      toast.success("Show cancelled — held/bookable inventory closed.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not cancel show");
    }
  };

  if (!shows) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Showtimes</h2>
        <Button className="bg-[#477BFF] hover:bg-[#5C89FF]" onClick={() => setOpen(true)} disabled={auditoriums.length === 0}>
          <Plus className="w-4 h-4 mr-1.5" /> Schedule show
        </Button>
      </div>

      {shows.length === 0 ? (
        <EmptyState icon={<CalendarOff className="w-6 h-6" />} title="No shows yet" hint="Schedule your first show — per-show seat inventory is generated automatically." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {shows.map((s) => (
            <div key={s.id} className="cine-card p-4 flex gap-3">
              { }
              <img src={s.movie.posterUrl} alt="" className="w-12 h-18 rounded-lg object-cover border border-white/10" style={{ aspectRatio: "2/3" }} />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate">{s.movie.title}</div>
                <div className="text-xs text-[#8FA3BF] mt-0.5">{fmtDateTime(s.startsAt)}</div>
                <div className="text-xs text-[#20D9E8]">{s.auditorium.theatre.name} · {s.auditorium.name} · {s.format}/{s.language}</div>
                <div className="text-xs mt-1.5 flex gap-3 text-[#8FA3BF]">
                  <span className="text-[#2FBF71]">{s.available} free</span>
                  <span className="text-[#F5C518]">{s.held} held</span>
                  <span className="text-[#E5484D]">{s.booked} booked</span>
                </div>
              </div>
              {new Date(s.startsAt) > new Date() && (
                <Button size="sm" variant="outline" className="border-[#E5484D]/40 text-[#E5484D] h-8 self-start" onClick={() => cancelShow(s.id)}>
                  Cancel
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#101218] border-white/10">
          <DialogHeader>
            <DialogTitle>Schedule a show</DialogTitle>
            <DialogDescription>A per-show seat inventory is generated from the auditorium&apos;s physical seats. Overlapping slots in the same auditorium are rejected.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <Label>Auditorium</Label>
              <select value={form.auditoriumId} onChange={(e) => setForm({ ...form, auditoriumId: e.target.value })} className="w-full h-9 rounded-md bg-[#0B0D12] border border-white/10 px-2 text-sm">
                <option value="">Select…</option>
                {auditoriums.map((a) => <option key={a.id} value={a.id}>{a.theatre.name} · {a.name} ({a._count?.seats} seats)</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Movie</Label>
              <select
                value={form.movieId}
                onChange={(e) => {
                  const m = movies.find((x) => x.id === e.target.value);
                  setForm({ ...form, movieId: e.target.value, language: m?.languages[0] || "" });
                }}
                className="w-full h-9 rounded-md bg-[#0B0D12] border border-white/10 px-2 text-sm"
              >
                <option value="">Select…</option>
                {movies.map((m) => <option key={m.id} value={m.id}>{m.title} ({m.durationMins} min)</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="space-y-1.5">
                <Label>Date</Label>
                <Input type="date" value={form.date} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setForm({ ...form, date: e.target.value })} className="bg-[#0B0D12] text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Time</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="bg-[#0B0D12] text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label>Format</Label>
                <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })} className="w-full h-9 rounded-md bg-[#0B0D12] border border-white/10 px-2 text-sm">
                  {["2D", "3D", "IMAX 2D", "IMAX 3D", "4DX"].map((f) => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Language</Label>
              <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className="bg-[#0B0D12]" placeholder="e.g. Tamil" />
            </div>
            {categories.length > 0 && (
              <div className="rounded-lg border border-white/10 p-3 space-y-2">
                <Label className="text-xs text-[#8FA3BF]">Category price overrides (₹, blank = default)</Label>
                <div className="grid grid-cols-3 gap-2">
                  {categories.map((c) => (
                    <div key={c} className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#20D9E8]">{c}</span>
                      <Input
                        type="number" min={0}
                        value={priceOverrides[c] ?? ""}
                        onChange={(e) => setPriceOverrides({ ...priceOverrides, [c]: e.target.value })}
                        className="h-8 bg-[#0B0D12] text-xs"
                        placeholder="default"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Button
              className="w-full bg-[#477BFF] hover:bg-[#5C89FF]"
              disabled={busy || !form.auditoriumId || !form.movieId || !form.date || !form.time}
              onClick={create}
            >
              {busy ? "Scheduling…" : "Schedule show"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Bookings() {
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    api.get<{ bookings: BookingRow[] }>(`/api/owner/bookings?status=${status}`)
      .then((d) => setBookings(d.bookings))
      .catch(() => setBookings([]));
  }, [status]);

  if (!bookings) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Bookings</h2>
        <div className="flex gap-1.5">
          {["", "CONFIRMED", "PENDING_PAYMENT", "CANCELLED", "REFUNDED"].map((s) => (
            <button
              key={s || "all"}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer transition-colors ${status === s ? "bg-[#477BFF] border-[#477BFF] text-white" : "border-white/10 text-[#8FA3BF] hover:text-white"}`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>
      {bookings.length === 0 ? (
        <EmptyState icon={<Ticket className="w-6 h-6" />} title="No bookings match" hint="Bookings appear here the moment customers hold seats." />
      ) : (
        <div className="overflow-x-auto cine-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-[#8FA3BF] uppercase tracking-wider">
                <th className="p-4 font-medium">Ref</th>
                <th className="p-4 font-medium">Customer</th>
                <th className="p-4 font-medium">Show</th>
                <th className="p-4 font-medium">Seats</th>
                <th className="p-4 font-medium">Amount</th>
                <th className="p-4 font-medium">Payment</th>
                <th className="p-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="p-4 font-mono text-xs">{b.reference}</td>
                  <td className="p-4">{b.user.name}<div className="text-xs text-[#8FA3BF]">{b.user.email}</div></td>
                  <td className="p-4">{b.show.movie.title}<div className="text-xs text-[#8FA3BF]">{fmtDateTime(b.show.startsAt)}</div></td>
                  <td className="p-4 text-xs">{b.seats.map((s) => `${s.rowLabel}${s.seatNumber}`).join(", ")}</td>
                  <td className="p-4">{inr(b.totalAmount)}</td>
                  <td className="p-4 text-xs">{b.payment ? `${b.payment.provider} · ${b.payment.status}${b.payment.method ? ` · ${b.payment.method}` : ""}` : "—"}</td>
                  <td className="p-4"><StatusBadge status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
