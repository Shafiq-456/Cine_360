"use client";
// Checkout — labelled demo payment (order → gateway settle → server verify).
import { useCallback, useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api, inr, fmtDateTime } from "@/lib/client";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Spinner, EmptyState, StatusBadge } from "./bits";
import { toast } from "sonner";
import { ShieldCheck, Loader2, CreditCard, AlertTriangle, Hourglass, CheckCircle2 } from "lucide-react";

type BookingDetail = {
  id: string;
  reference: string;
  status: string;
  totalAmount: number;
  hold?: { expiresAt: string };
  seats: { rowLabel: string; seatNumber: number; categoryName: string; price: number }[];
  show: {
    id: string;
    startsAt: string; format: string; language: string;
    movie: { title: string; posterUrl: string };
    auditorium: { name: string; theatre: { name: string; city: string } };
  };
};

export default function CheckoutView({ bookingId }: { bookingId: string }) {
  const { session, sessionLoaded } = useAuth();
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [stage, setStage] = useState<"choose" | "processing" | "verifying">("choose");
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!session) {
      sessionStorage.setItem("c360_return", `#/checkout/${bookingId}`);
      navigate("/login");
      return;
    }
    api.get<{ booking: BookingDetail }>(`/api/bookings/${bookingId}`)
      .then((d) => setBooking(d.booking))
      .catch(() => setNotFound(true));
  }, [sessionLoaded, session, bookingId]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const holdRemain = booking?.hold?.expiresAt
    ? Math.max(0, Math.floor((new Date(booking.hold.expiresAt).getTime() - now) / 1000))
    : null;

  const pay = useCallback(async (outcome: "success" | "failure") => {
    if (!booking) return;
    setStage("processing");
    try {
      const order = await api.post<{ orderId: string }>("/api/payments/create-order", { bookingId: booking.id });
      const settle = await api.post<{ gatewayPaymentId: string; signature: string }>("/api/payments/demo-settle", {
        orderId: order.orderId,
        outcome,
        method: outcome === "success" ? "upi" : "card_declined",
      });
      if (outcome === "failure") {
        setStage("choose");
        setPayOpen(false);
        toast.error("Payment failed (demo). Seats have been released and the booking cancelled.");
        navigate("/tickets");
        return;
      }
      setStage("verifying");
      const result = await api.post<{ booking: { id: string; status: string } }>("/api/payments/verify", {
        orderId: order.orderId,
        gatewayPaymentId: settle.gatewayPaymentId,
        signature: settle.signature,
      });
      toast.success("Payment verified — booking confirmed!");
      navigate(`/tickets/${result.booking.id}`);
    } catch (e) {
      setStage("choose");
      setPayOpen(false);
      toast.error(e instanceof Error ? e.message : "Payment could not be completed");
      api.get<{ booking: BookingDetail }>(`/api/bookings/${bookingId}`).then((d) => setBooking(d.booking)).catch(() => {});
    }
  }, [booking]);

  if (notFound) return <EmptyState title="Booking not found" action={<Button onClick={() => navigate("/tickets")}>My tickets</Button>} />;
  if (!booking) return <div className="py-32 flex justify-center"><Spinner label="Loading booking…" /></div>;

  const seatLabel = booking.seats.map((s) => `R${s.rowLabel}·S${s.seatNumber}`).join(", ");
  const expired = holdRemain !== null && holdRemain <= 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-1">Checkout</h1>
      <p className="text-sm text-[#B4A6D4] mb-8">Booking reference <span className="font-mono text-[#F2B04C]">{booking.reference}</span> · <StatusBadge status={booking.status} /></p>

      {booking.status === "PENDING_PAYMENT" && (
        <div className={`cine-card p-4 mb-6 flex items-center gap-3 text-sm ${expired ? "border-[#E5484D]/40" : "border-[#FFD166]/30"}`}>
          {expired ? <AlertTriangle className="w-5 h-5 text-[#E5484D] shrink-0" /> : <Hourglass className="w-5 h-5 text-[#FFD166] shrink-0" />}
          {expired ? (
            <span>This hold has expired and the seats were released. <button onClick={() => navigate(booking.show ? `/book/${booking.show.id}` : "/movies")} className="text-[#8B5CF6] hover:underline cursor-pointer">Pick seats again</button>.</span>
          ) : (
            <span>
              Seats are held for another{" "}
              <b className="text-[#FFD166] font-mono">
                {String(Math.floor(holdRemain! / 60)).padStart(2, "0")}:{String(holdRemain! % 60).padStart(2, "0")}
              </b>{" "}
              — complete payment before the timer runs out.
            </span>
          )}
        </div>
      )}

      <div className="cine-card p-6">
        <div className="flex gap-4">
          { }
          <img src={booking.show.movie.posterUrl} alt="" className="w-20 h-30 rounded-lg object-cover border border-white/10" style={{ aspectRatio: "2/3" }} />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg">{booking.show.movie.title}</h2>
            <p className="text-sm text-[#B4A6D4] mt-0.5">{fmtDateTime(booking.show.startsAt)}</p>
            <p className="text-sm text-[#B4A6D4]">{booking.show.auditorium.theatre.name} · {booking.show.auditorium.name}</p>
            <p className="text-xs text-[#F2B04C] mt-1">{booking.show.format} · {booking.show.language}</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl bg-white/[0.03] border border-white/5 p-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#B4A6D4]">Seats</span>
            <span className="font-medium">{seatLabel}</span>
          </div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#B4A6D4]">Tickets ({booking.seats.length})</span>
            <span>{booking.seats.map((s) => `${s.categoryName} ${inr(s.price)}`).join(" · ")}</span>
          </div>
          <div className="flex items-center justify-between border-t border-white/5 pt-3">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-xl text-[#F2B04C]">{inr(booking.totalAmount)}</span>
          </div>
        </div>

        {booking.status === "PENDING_PAYMENT" && !expired && (
          <Button className="w-full mt-6 h-12 bg-[#8B5CF6] hover:bg-[#A78BFA] text-base font-semibold" onClick={() => { setPayOpen(true); setStage("choose"); }}>
            <CreditCard className="w-5 h-5 mr-2" /> Pay {inr(booking.totalAmount)}
          </Button>
        )}
        {booking.status !== "PENDING_PAYMENT" && (
          <Button className="w-full mt-6 h-12" variant="outline" onClick={() => navigate(`/tickets/${booking.id}`)}>
            <CheckCircle2 className="w-4 h-4 mr-2" /> View tickets
          </Button>
        )}
      </div>

      <p className="text-[11px] text-[#B4A6D4] mt-4 flex items-center gap-1.5">
        <ShieldCheck className="w-3.5 h-3.5 text-[#34D399]" />
        Payments are verified server-side with signature validation. Bookings are never confirmed from the frontend alone.
      </p>

      {/* ============ DEMO GATEWAY MODAL (clearly labelled TEST MODE) ============ */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="bg-[#1A1029] border-white/10 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-[#8B5CF6]" /> Demo Payment Gateway
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FFD166]/15 text-[#FFD166] border border-[#FFD166]/40 ml-1">TEST MODE</span>
            </DialogTitle>
            <DialogDescription className="text-[#B4A6D4]">
              No real money is charged. The flow is identical to production: server-side order → gateway settle with HMAC signature → server verification → booking confirmation.
            </DialogDescription>
          </DialogHeader>

          {stage === "choose" && (
            <div className="space-y-2.5 pt-2">
              <div className="flex justify-between text-sm px-1 pb-2">
                <span className="text-[#B4A6D4]">Paying for {booking.reference}</span>
                <b>{inr(booking.totalAmount)}</b>
              </div>
              <button onClick={() => pay("success")} className="w-full py-3.5 rounded-xl bg-[#34D399]/15 border border-[#34D399]/40 text-[#34D399] font-semibold hover:bg-[#34D399]/25 transition-colors cursor-pointer">
                Simulate successful payment (UPI)
              </button>
              <button onClick={() => pay("failure")} className="w-full py-3.5 rounded-xl bg-[#E5484D]/10 border border-[#E5484D]/40 text-[#E5484D] font-medium hover:bg-[#E5484D]/20 transition-colors cursor-pointer">
                Simulate failed payment
              </button>
              <p className="text-[10px] text-[#B4A6D4]/70 px-1 pt-1">In production this dialog is replaced by the Razorpay checkout with real keys; webhook events are processed idempotently.</p>
            </div>
          )}
          {stage === "processing" && (
            <div className="py-8 flex justify-center"><Spinner label="Contacting demo gateway…" /></div>
          )}
          {stage === "verifying" && (
            <div className="py-8 flex justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
                <span className="text-sm text-[#B4A6D4]">Verifying signature &amp; confirming booking…</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
