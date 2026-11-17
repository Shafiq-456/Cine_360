"use client";
// Ticket detail — QR codes generated server-side; code encodes ONLY the opaque ticket id.
import { useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api, inr, fmtDateTime } from "@/lib/client";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Spinner, EmptyState, StatusBadge } from "./bits";
import { Download, MapPin, Clock, Printer } from "lucide-react";

type TicketDetail = {
  id: string;
  reference: string;
  status: string;
  totalAmount: number;
  seats: { rowLabel: string; seatNumber: number; categoryName: string; price: number }[];
  tickets: { id: string; code: string; status: string; rowLabel: string; seatNumber: number; qrDataUrl: string }[];
  show: {
    startsAt: string;
    format: string;
    language: string;
    movie: { title: string; posterUrl: string };
    auditorium: { name: string; theatre: { name: string; city: string; address: string } };
  };
};

export default function TicketDetailView({ id }: { id: string }) {
  const { session, sessionLoaded } = useAuth();
  const [booking, setBooking] = useState<TicketDetail | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session) {
      sessionStorage.setItem("c360_return", `#/tickets/${id}`);
      navigate("/login");
      return;
    }
    api.get<{ booking: TicketDetail }>(`/api/bookings/${id}`)
      .then((d) => setBooking(d.booking))
      .catch(() => setNotFound(true));
  }, [session, sessionLoaded, id]);

  if (notFound) return <EmptyState title="Booking not found" />;
  if (!booking) return <div className="py-32 flex justify-center"><Spinner label="Loading ticket…" /></div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <button onClick={() => navigate("/tickets")} className="text-xs text-[#F59E0B] hover:underline cursor-pointer mb-4">← All bookings</button>

      <div className="cine-card overflow-hidden">
        {/* stub */}
        <div className="bg-gradient-to-r from-[#F59E0B]/25 via-[#FBBF24]/15 to-transparent px-6 py-5 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#FBBF24] mb-1">CINE 360 e-ticket</div>
            <h1 className="text-2xl font-bold">{booking.show.movie.title}</h1>
            <p className="text-xs text-[#94A3B8] mt-1">Ref {booking.reference} · <StatusBadge status={booking.status} /></p>
          </div>
          <img src={booking.show.movie.posterUrl} alt="" className="w-16 h-24 rounded-lg object-cover border border-white/10 hidden sm:block" />
        </div>

        <div className="px-6 py-5 grid grid-cols-2 gap-4 text-sm">
          <Info icon={<Clock className="w-4 h-4" />} label="Showtime" value={fmtDateTime(booking.show.startsAt)} />
          <Info icon={<MapPin className="w-4 h-4" />} label="Theatre" value={`${booking.show.auditorium.theatre.name} · ${booking.show.auditorium.name}`} />
          <Info label="Format" value={`${booking.show.format} · ${booking.show.language}`} />
          <Info label="Seats" value={booking.seats.map((s) => `${s.rowLabel}${s.seatNumber}`).join(", ")} />
        </div>

        {/* perforation */}
        <div className="relative h-px bg-white/10 mx-6">
          <span className="absolute -left-8 -top-2 w-4 h-4 rounded-full bg-[#070709] border border-white/10" />
          <span className="absolute -right-8 -top-2 w-4 h-4 rounded-full bg-[#070709] border border-white/10" />
        </div>

        {/* QR tickets */}
        <div className="px-6 py-6 grid sm:grid-cols-2 gap-4">
          {booking.tickets.map((t) => (
            <div key={t.id} className="rounded-xl bg-white p-4 flex flex-col items-center gap-2">
              <img src={t.qrDataUrl} alt={`QR code for seat ${t.rowLabel}${t.seatNumber}`} className="w-44 h-44" />
              <div className="text-center">
                <div className="text-slate-950 font-bold">Row {t.rowLabel} · Seat {t.seatNumber}</div>
                <div className="text-[10px] text-[#5A6572] font-mono mt-0.5 break-all max-w-[200px]">{t.code}</div>
                <div className="text-xs mt-1 font-semibold" style={{ color: t.status === "VALID" ? "#1B7F4D" : t.status === "REDEEMED" ? "#D97706" : "#888" }}>
                  {t.status === "VALID" ? "Show this QR at the gate" : t.status === "REDEEMED" ? "Already redeemed" : "Void"}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6">
          <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <div>
              <span className="text-[#B4A6D4]">Total paid</span>
              <div className="text-xl font-bold text-white">{inr(booking.totalAmount)}</div>
            </div>
            <Button
              onClick={() => window.print()}
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10 gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <Printer className="w-4 h-4 text-[#F59E0B]" /> Print / Save Ticket (PDF)
            </Button>
          </div>
          <p className="text-[11px] text-[#B4A6D4] mt-3 leading-relaxed">
            The QR contains only an opaque ticket code — no personal or payment data. Staff scan it against the backend, which rejects duplicates and voided tickets.
          </p>
        </div>
      </div>
    </div>
  );
}

function Info({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/[0.03] border border-white/5 p-3">
      <div className="text-[10px] uppercase tracking-wider text-[#B4A6D4] flex items-center gap-1.5">{icon} {label}</div>
      <div className="font-medium mt-1">{value}</div>
    </div>
  );
}
