"use client";
// Personalized Cinema Dashboard: User Profile, Watchlist, Active Tickets, Waitlists & Booking History.
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/store";
import { api, inr, fmtDateTime } from "@/lib/client";
import { navigate } from "@/lib/router";
import {
  User,
  Ticket,
  Bookmark,
  Bell,
  Clock,
  ShieldCheck,
  Film,
  Building2,
  Calendar,
  Sparkles,
  ChevronRight,
  Trash2,
  Printer,
  QrCode,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "./bits";
import { toast } from "sonner";

export default function ProfileDashboardView() {
  const { session } = useAuth();
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [waitlists, setWaitlists] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "watchlist" | "waitlists" | "bookings">("overview");

  useEffect(() => {
    if (!session) {
      sessionStorage.setItem("c360_return", "#/profile");
      navigate("/login");
      return;
    }

    Promise.allSettled([
      api.get<any[]>("/api/watchlist"),
      api.get<any[]>("/api/waitlist"),
      api.get<{ bookings: any[] }>("/api/bookings/my"),
    ]).then(([wlRes, wtRes, bkRes]) => {
      if (wlRes.status === "fulfilled" && Array.isArray(wlRes.value)) {
        setWatchlist(wlRes.value);
      }
      if (wtRes.status === "fulfilled" && Array.isArray(wtRes.value)) {
        setWaitlists(wtRes.value);
      }
      if (bkRes.status === "fulfilled" && bkRes.value?.bookings) {
        setBookings(bkRes.value.bookings);
      }
      setLoading(false);
    });
  }, [session]);

  const removeWatchlist = async (movieId: string, title: string) => {
    try {
      await api.del(`/api/watchlist?movieId=${movieId}`);
      setWatchlist((prev) => prev.filter((m) => m.id !== movieId));
      toast.success(`Removed "${title}" from watchlist`);
    } catch {
      toast.error("Failed to remove from watchlist");
    }
  };

  const removeWaitlist = async (showId: string) => {
    try {
      await api.del(`/api/waitlist?showId=${showId}`);
      setWaitlists((prev) => prev.filter((w) => w.showId !== showId));
      toast.success("Removed from show waitlist");
    } catch {
      toast.error("Failed to update waitlist");
    }
  };

  if (loading) {
    return (
      <div className="py-32 flex justify-center">
        <Spinner label="Loading your Cinema Dashboard…" />
      </div>
    );
  }

  const upcomingBookings = bookings.filter((b) => b.status === "CONFIRMED" && new Date(b.show.startsAt) >= new Date());
  const pastBookings = bookings.filter((b) => b.status === "CONFIRMED" && new Date(b.show.startsAt) < new Date());

  return (
    <div className="max-w-7xl mx-auto px-4 py-10 space-y-8">
      {/* Profile Header Card */}
      <div className="cine-card p-6 md:p-8 rounded-2xl border border-white/10 bg-[#0B0D13] relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <Avatar className="w-16 h-16 border-2 border-[#F59E0B]/50 shadow-xl shadow-amber-500/20">
            <AvatarFallback className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] text-slate-950 text-xl font-bold">
              {session?.name.split(" ").map((n) => n[0]).slice(0, 2).join("") || "U"}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-white tracking-tight">{session?.name}</h1>
              <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30 font-semibold">
                {session?.role}
              </span>
            </div>
            <p className="text-xs text-[#94A3B8] mt-0.5">{session?.email}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-[#CBD5E1]">
              <span className="flex items-center gap-1">
                <Ticket className="w-3.5 h-3.5 text-[#F59E0B]" /> {bookings.length} Bookings
              </span>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5 text-[#38BDF8]" /> {watchlist.length} Saved
              </span>
              <span className="text-white/20">·</span>
              <span className="flex items-center gap-1">
                <Bell className="w-3.5 h-3.5 text-[#10B981]" /> {waitlists.length} Alerts
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
          <Button
            size="sm"
            onClick={() => navigate("/tickets")}
            className="bg-gradient-to-r from-[#F59E0B] to-[#D97706] hover:from-[#FBBF24] hover:to-[#F59E0B] text-slate-950 font-bold text-xs gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <QrCode className="w-3.5 h-3.5" /> My QR Tickets
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate("/movies")}
            className="border-white/15 text-white hover:border-[#F59E0B] hover:text-[#FBBF24] text-xs gap-1.5 cursor-pointer"
          >
            <Film className="w-3.5 h-3.5 text-[#F59E0B]" /> Explore Films
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveTab("overview")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
            activeTab === "overview"
              ? "bg-white/10 text-white border border-white/20"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          Dashboard Overview
        </button>
        <button
          onClick={() => setActiveTab("watchlist")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "watchlist"
              ? "bg-white/10 text-white border border-white/20"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <Bookmark className="w-3.5 h-3.5 text-[#38BDF8]" /> Watchlist ({watchlist.length})
        </button>
        <button
          onClick={() => setActiveTab("waitlists")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "waitlists"
              ? "bg-white/10 text-white border border-white/20"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-[#10B981]" /> Waitlists ({waitlists.length})
        </button>
        <button
          onClick={() => setActiveTab("bookings")}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeTab === "bookings"
              ? "bg-white/10 text-white border border-white/20"
              : "text-[#94A3B8] hover:text-white"
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-[#F59E0B]" /> Booking History ({bookings.length})
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === "overview" && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Upcoming Screenings */}
          <div className="cine-card p-6 rounded-2xl border border-white/10 bg-[#120A1C] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Ticket className="w-4 h-4 text-[#8B5CF6]" /> Upcoming Shows
              </h2>
              <button onClick={() => navigate("/tickets")} className="text-xs text-[#8B5CF6] hover:underline cursor-pointer">
                View All
              </button>
            </div>
            {upcomingBookings.length === 0 ? (
              <p className="text-xs text-[#94A3B8] py-6 text-center">
                No upcoming bookings right now. Ready for your next film?
              </p>
            ) : (
              upcomingBookings.slice(0, 3).map((b) => (
                <div
                  key={b.id}
                  onClick={() => navigate(`/tickets/${b.id}`)}
                  className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-all cursor-pointer flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <img src={b.show.movie.posterUrl} alt="" className="w-10 h-14 object-cover rounded-md border border-white/10" />
                    <div>
                      <div className="text-sm font-semibold text-white">{b.show.movie.title}</div>
                      <div className="text-xs text-[#94A3B8]">{b.show.auditorium.theatre.name} · {b.show.auditorium.name}</div>
                      <div className="text-[11px] text-[#F59E0B] mt-0.5">{fmtDateTime(b.show.startsAt)}</div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#94A3B8]" />
                </div>
              ))
            )}
          </div>

          {/* Watchlist Quick View */}
          <div className="cine-card p-6 rounded-2xl border border-white/10 bg-[#120A1C] space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-[#38BDF8]" /> Saved in Watchlist
              </h2>
              <button onClick={() => setActiveTab("watchlist")} className="text-xs text-[#38BDF8] hover:underline cursor-pointer">
                Manage ({watchlist.length})
              </button>
            </div>
            {watchlist.length === 0 ? (
              <p className="text-xs text-[#94A3B8] py-6 text-center">
                Your watchlist is empty. Bookmark upcoming movies to get notified!
              </p>
            ) : (
              watchlist.slice(0, 3).map((m) => (
                <div
                  key={m.id}
                  className="p-3 rounded-xl border border-white/10 bg-white/[0.02] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate(`/movies/${m.slug || m.id}`)}>
                    <img src={m.posterUrl} alt="" className="w-9 h-12 object-cover rounded border border-white/10" />
                    <div>
                      <div className="text-xs font-semibold text-white hover:text-[#F59E0B] transition-colors">{m.title}</div>
                      <div className="text-[11px] text-[#94A3B8]">{m.durationMins} min · {m.certification}</div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/movies/${m.slug || m.id}`)}
                    className="border-white/15 text-xs h-8"
                  >
                    Book
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab: Watchlist */}
      {activeTab === "watchlist" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white">Your Cinema Watchlist</h2>
            <Button size="sm" onClick={() => navigate("/movies")} className="bg-[#8B5CF6] text-xs">
              Explore More Movies
            </Button>
          </div>
          {watchlist.length === 0 ? (
            <div className="cine-card p-12 text-center text-xs text-[#94A3B8]">
              No movies currently saved in your watchlist.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {watchlist.map((m) => (
                <div
                  key={m.id}
                  className="cine-card rounded-xl overflow-hidden border border-white/10 bg-[#140B22] group relative"
                >
                  <img src={m.posterUrl} alt={m.title} className="w-full aspect-[2/3] object-cover" />
                  <button
                    onClick={() => removeWatchlist(m.id, m.title)}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:text-[#EF4444] hover:bg-black/80 transition-colors cursor-pointer"
                    title="Remove from watchlist"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  <div className="p-3">
                    <h3 className="text-xs font-semibold text-white truncate">{m.title}</h3>
                    <p className="text-[11px] text-[#94A3B8]">{m.certification} · {m.durationMins}m</p>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/movies/${m.slug || m.id}`)}
                      className="w-full mt-2 h-7 text-xs bg-[#8B5CF6] hover:bg-[#A78BFA] text-white"
                    >
                      View Shows
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Waitlists */}
      {activeTab === "waitlists" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Active Show Waitlists</h2>
          <p className="text-xs text-[#94A3B8]">
            When seats are released for these screenings, you will be notified in real time.
          </p>
          {waitlists.length === 0 ? (
            <div className="cine-card p-12 text-center text-xs text-[#94A3B8]">
              You have not joined any show waitlists. When a show has limited seats, click "Join Waitlist" on the booking page.
            </div>
          ) : (
            <div className="space-y-3">
              {waitlists.map((w) => (
                <div
                  key={w.id}
                  className="cine-card p-4 rounded-xl border border-white/10 bg-[#140B22] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <img src={w.show.movie.posterUrl} alt="" className="w-10 h-14 object-cover rounded border border-white/10" />
                    <div>
                      <div className="text-sm font-semibold text-white">{w.show.movie.title}</div>
                      <div className="text-xs text-[#94A3B8]">
                        {w.show.auditorium.theatre.name} · {w.show.auditorium.name} ({w.show.format})
                      </div>
                      <div className="text-xs text-[#F59E0B] mt-0.5">{fmtDateTime(w.show.startsAt)}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/book/${w.show.id}`)}
                      className="bg-[#8B5CF6] text-xs h-8"
                    >
                      Check Seats
                    </Button>
                    <button
                      onClick={() => removeWaitlist(w.showId)}
                      className="p-2 text-[#94A3B8] hover:text-[#EF4444] cursor-pointer"
                      title="Leave waitlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Bookings */}
      {activeTab === "bookings" && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-white">Full Booking History</h2>
          {bookings.length === 0 ? (
            <div className="cine-card p-12 text-center text-xs text-[#94A3B8]">
              No transactions recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {bookings.map((b) => (
                <div
                  key={b.id}
                  className="cine-card p-4 rounded-xl border border-white/10 bg-[#140B22] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <img src={b.show.movie.posterUrl} alt="" className="w-12 h-16 object-cover rounded border border-white/10" />
                    <div>
                      <div className="text-sm font-bold text-white">{b.show.movie.title}</div>
                      <div className="text-xs text-[#94A3B8]">Ref: <span className="font-mono text-white">{b.reference}</span></div>
                      <div className="text-xs text-[#CBD5E1] mt-0.5">
                        {b.show.auditorium.theatre.name} · {fmtDateTime(b.show.startsAt)}
                      </div>
                      <div className="text-xs text-[#34D399] font-semibold mt-1">
                        {inr(b.totalAmount)} · {b.seats?.length || 0} Seat(s)
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-center">
                    <Button
                      size="sm"
                      onClick={() => navigate(`/tickets/${b.id}`)}
                      className="bg-[#8B5CF6] text-xs h-8"
                    >
                      View QR Ticket
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
