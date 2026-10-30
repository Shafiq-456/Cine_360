"use client";
// My Tickets — booking history with status.
import { useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api, inr, fmtDateTime } from "@/lib/client";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Spinner, EmptyState, StatusBadge, PageTitle } from "./bits";
import { Ticket as TicketIcon, ChevronRight } from "lucide-react";

type MyBooking = {
  id: string;
  reference: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  seats: { rowLabel: string; seatNumber: number }[];
  payment?: { status: string; provider: string } | null;
  tickets: { id: string; code: string; status: string }[];
  show: {
    startsAt: string;
    movie: { title: string; posterUrl: string };
    auditorium: { name: string; theatre: { name: string; city: string } };
  };
};

export default function TicketsView() {
  const { session, sessionLoaded } = useAuth();
  const [bookings, setBookings] = useState<MyBooking[] | null>(null);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session) {
      sessionStorage.setItem("c360_return", "#/tickets");
      navigate("/login");
      return;
    }
    api.get<{ bookings: MyBooking[] }>("/api/bookings/my")
      .then((d) => setBookings(d.bookings))
      .catch(() => setBookings([]));
  }, [session, sessionLoaded]);

  if (!bookings) return <div className="py-32 flex justify-center"><Spinner label="Loading your tickets…" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <PageTitle title="My Tickets" subtitle="Every booking, from hold to QR redemption." />
      {bookings.length === 0 ? (
        <EmptyState
          icon={<TicketIcon className="w-6 h-6" />}
          title="No bookings yet"
          hint="Pick a movie, choose seats in 3D and complete the test-mode checkout to see your QR tickets here."
          action={<Button className="bg-[#477BFF] hover:bg-[#5C89FF]" onClick={() => navigate("/movies")}>Browse movies</Button>}
        />
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => (
            <button key={b.id} onClick={() => navigate(`/tickets/${b.id}`)} className="w-full cine-card cine-card-hover p-4 flex items-center gap-4 text-left cursor-pointer">
              { }
              <img src={b.show.movie.posterUrl} alt="" className="w-14 h-20 rounded-lg object-cover border border-white/10 shrink-0" loading="lazy" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold">{b.show.movie.title}</span>
                  <StatusBadge status={b.status} />
                </div>
                <div className="text-xs text-[#8FA3BF] mt-1">
                  {fmtDateTime(b.show.startsAt)} · {b.show.auditorium.theatre.name} · {b.show.auditorium.name}
                </div>
                <div className="text-xs text-[#8FA3BF] mt-0.5">
                  {b.seats.map((s) => `${s.rowLabel}${s.seatNumber}`).join(", ")} · {b.reference} · {inr(b.totalAmount)}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#8FA3BF] shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
