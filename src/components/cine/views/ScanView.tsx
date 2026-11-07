"use client";
// Staff scanner — verify/redeem QR tickets against the backend.
// Camera scanning when permitted, manual code entry always available.
import { useEffect, useRef, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";
import { useAuth } from "@/lib/store";
import { navigate } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner, StatusBadge } from "./bits";
import { toast } from "sonner";
import { ScanLine, Keyboard, Camera, CameraOff, CheckCircle2, AlertTriangle, XCircle, History } from "lucide-react";

type ValidateResult = {
  result: string;
  detail?: string;
  firstRedeemedAt?: string | null;
  ticket?: {
    code: string;
    status: string;
    rowLabel: string;
    seatNumber: number;
    booking: {
      reference: string;
      user: { name: string };
      show: { startsAt: string; movie: { title: string }; auditorium: { name: string; theatre: { name: string } } };
    };
  };
};

type HistoryRow = { code: string; result: string; at: string };

export default function ScanView() {
  const { session, sessionLoaded } = useAuth();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<ValidateResult | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [camState, setCamState] = useState<"idle" | "starting" | "on" | "denied">("idle");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (sessionLoaded && session && !["STAFF", "OWNER", "ADMIN"].includes(session.role)) {
      toast.error("The scanner is for theatre staff, owners and admins.");
      navigate("/");
    }
  }, [session, sessionLoaded]);

  const submit = async (action: "check" | "redeem", rawCode?: string) => {
    const c = (rawCode ?? code).trim();
    if (!c) return;
    setBusy(true);
    try {
      const res = await api.post<ValidateResult>("/api/tickets/validate", { code: c, action });
      setLast(res);
      setHistory((h) => [{ code: c, result: res.result, at: new Date().toISOString() }, ...h].slice(0, 12));
      if (res.result === "SUCCESS") toast.success("Ticket redeemed — admit the guest");
      else if (res.result === "VALID") toast.info("Ticket is genuine (check only)");
      else if (res.result === "ALREADY_REDEEMED") toast.warning("Already redeemed — refuse duplicate entry");
      else toast.error(res.result);
      setCode("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Validation failed";
      setLast({ result: "INVALID", detail: msg });
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  };

  const startCamera = async () => {
    setCamState("starting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCamState("on");
      // lightweight QR attempt loop using the BarcodeDetector API when present
      const BD = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
      if (!BD) {
        toast.info("Continuous QR detection is not supported in this browser — enter the code manually below.");
        return;
      }
      const detector = new BD({ formats: ["qr_code"] });
      const tick = async () => {
        if (!videoRef.current || !canvasRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          if (found.length > 0 && found[0].rawValue) {
            await submit("redeem", found[0].rawValue);
            streamRef.current?.getTracks().forEach((t) => t.stop());
            setCamState("idle");
            return;
          }
        } catch {
          /* frame skipped */
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      setCamState("denied");
      toast.error("Camera unavailable in this environment — use manual code entry.");
    }
  };

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    cancelAnimationFrame(rafRef.current);
  }, []);

  if (!sessionLoaded) return <div className="py-32 flex justify-center"><Spinner /></div>;

  const banner =
    last?.result === "SUCCESS"
      ? { cls: "border-[#34D399]/50 bg-[#34D399]/10 text-[#34D399]", icon: <CheckCircle2 className="w-8 h-8" />, title: "Ticket redeemed" }
      : last?.result === "ALREADY_REDEEMED"
      ? { cls: "border-[#FFD166]/50 bg-[#FFD166]/10 text-[#FFD166]", icon: <AlertTriangle className="w-8 h-8" />, title: "Already redeemed" }
      : last?.result === "VOID"
      ? { cls: "border-[#E5484D]/50 bg-[#E5484D]/10 text-[#E5484D]", icon: <XCircle className="w-8 h-8" />, title: "Void ticket" }
      : last
      ? { cls: "border-[#E5484D]/50 bg-[#E5484D]/10 text-[#E5484D]", icon: <XCircle className="w-8 h-8" />, title: "Invalid ticket" }
      : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-3xl font-bold mb-1 flex items-center gap-2"><ScanLine className="w-7 h-7 text-[#8B5CF6]" /> Gate Scanner</h1>
      <p className="text-sm text-[#B4A6D4] mb-8">
        Signed in as <b className="text-[#EAE2FA]">{session?.name}</b> ({session?.role}). Validation is backend-authoritative: show match, ticket status and duplicate redemption are all checked server-side.
      </p>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Scanner side */}
        <div className="space-y-4">
          <div className="cine-card p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Camera className="w-4 h-4 text-[#F2B04C]" /> Camera scan</h2>
            <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-video flex items-center justify-center">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover" muted playsInline />
              <canvas ref={canvasRef} className="hidden" />
              {camState !== "on" && (
                <div className="text-center text-[#B4A6D4] text-sm px-6">
                  {camState === "denied" ? (
                    <><CameraOff className="w-6 h-6 mx-auto mb-2" /> Camera blocked — manual entry below</>
                  ) : (
                    <>Camera preview appears here</>
                  )}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-3">
              {camState !== "on" ? (
                <Button className="bg-[#F2B04C]/15 border border-[#F2B04C]/40 text-[#F2B04C] hover:bg-[#F2B04C]/25" variant="outline" onClick={startCamera} disabled={busy}>
                  Start camera
                </Button>
              ) : (
                <Button variant="outline" className="border-white/15" onClick={() => { streamRef.current?.getTracks().forEach((t) => t.stop()); setCamState("idle"); }}>
                  Stop camera
                </Button>
              )}
            </div>
          </div>

          <div className="cine-card p-5">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Keyboard className="w-4 h-4 text-[#8B5CF6]" /> Manual entry</h2>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="C360T-…"
                className="bg-[#150C22] font-mono text-sm"
                aria-label="Ticket code"
                onKeyDown={(e) => e.key === "Enter" && submit("redeem")}
              />
              <Button variant="outline" className="border-white/15" onClick={() => submit("check")} disabled={busy || !code}>Check</Button>
              <Button className="bg-[#8B5CF6] hover:bg-[#A78BFA]" onClick={() => submit("redeem")} disabled={busy || !code}>Redeem</Button>
            </div>
            <p className="text-[11px] text-[#B4A6D4] mt-2">“Check” verifies without redeeming. “Redeem” marks the ticket used — duplicates are rejected by the backend.</p>
          </div>
        </div>

        {/* Result side */}
        <div className="space-y-4">
          {banner && last ? (
            <div className={`cine-card p-5 border ${banner.cls}`} role="status">
              <div className="flex items-center gap-3 mb-3">
                {banner.icon}
                <div>
                  <div className="font-bold text-lg">{banner.title}</div>
                  <div className="text-xs opacity-80">{last.detail}</div>
                </div>
              </div>
              {last.ticket && (
                <div className="rounded-lg bg-black/20 p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="opacity-70">Guest</span><b>{last.ticket.booking.user.name}</b></div>
                  <div className="flex justify-between"><span className="opacity-70">Movie</span><b>{last.ticket.booking.show.movie.title}</b></div>
                  <div className="flex justify-between"><span className="opacity-70">Show</span><b>{fmtDateTime(last.ticket.booking.show.startsAt)}</b></div>
                  <div className="flex justify-between"><span className="opacity-70">Venue</span><b>{last.ticket.booking.show.auditorium.theatre.name} · {last.ticket.booking.show.auditorium.name}</b></div>
                  <div className="flex justify-between"><span className="opacity-70">Seat</span><b>Row {last.ticket.rowLabel} · Seat {last.ticket.seatNumber}</b></div>
                  <div className="flex justify-between"><span className="opacity-70">Ref</span><span className="font-mono">{last.ticket.booking.reference}</span></div>
                  {last.firstRedeemedAt && (
                    <div className="flex justify-between"><span className="opacity-70">First redeemed</span><b>{fmtDateTime(last.firstRedeemedAt)}</b></div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="cine-card p-8 text-center text-[#B4A6D4] text-sm">
              <ScanLine className="w-8 h-8 mx-auto mb-3 text-[#8B5CF6]/50" />
              Scan or enter a ticket code. Results appear here with full show and seat verification.
            </div>
          )}

          <div className="cine-card p-5">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><History className="w-4 h-4 text-[#B4A6D4]" /> Recent scans</h3>
            {history.length === 0 ? (
              <p className="text-xs text-[#B4A6D4]">Nothing scanned yet in this session.</p>
            ) : (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto cine-scroll">
                {history.map((h, i) => (
                  <li key={i} className="flex items-center justify-between text-xs px-2 py-1.5 rounded bg-white/[0.03]">
                    <span className="font-mono truncate max-w-[180px]">{h.code}</span>
                    <StatusBadge status={h.result === "SUCCESS" ? "VALID" : h.result === "ALREADY_REDEEMED" ? "REDEEMED" : "VOID"} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
