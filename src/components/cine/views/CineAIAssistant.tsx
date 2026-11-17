"use client";
// CINE AI — Smart Deterministic Cinema Assistant.
import { useState, useEffect, useRef } from "react";
import { api, inr } from "@/lib/client";
import { navigate } from "@/lib/router";
import {
  Sparkles,
  Bot,
  X,
  Send,
  Film,
  MapPin,
  Eye,
  CreditCard,
  ChevronRight,
  ShieldCheck,
  Minimize2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  sender: "user" | "ai";
  text: string;
  options?: Array<{ label: string; action: () => void }>;
};

const SUGGESTIONS = [
  "What movies are currently showing?",
  "How does 3D SeatVision work?",
  "Explain seat categories and pricing",
  "Where are the theatres located?",
  "How do 5-minute seat holds work?",
];

export default function CineAIAssistant() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      sender: "ai",
      text: "Hello! I am CINE AI, your smart cinema companion. I can help you discover movies, explain our 3D SeatVision sightline engine, find venues, and navigate your booking.",
      options: [
        { label: "🎬 Now Showing", action: () => handlePrompt("What movies are currently showing?") },
        { label: "📐 How 3D SeatVision works", action: () => handlePrompt("How does 3D SeatVision work?") },
        { label: "🎟️ Seat Categories", action: () => handlePrompt("Explain seat categories and pricing") },
        { label: "📍 Find Theatres", action: () => handlePrompt("Where are the theatres located?") },
      ],
    },
  ]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const handlePrompt = async (promptText: string) => {
    if (!promptText.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: promptText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setBusy(true);

    const q = promptText.toLowerCase();

    // Deterministic factual responses using live application state
    setTimeout(async () => {
      let reply: Message;

      if (q.includes("movie") || q.includes("showing") || q.includes("film")) {
        try {
          const res = await api.get<{ movies: any[] }>("/api/movies?status=NOW_SHOWING");
          const titles = res.movies.slice(0, 4);
          reply = {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: `Here are the top films currently screening in CINE 360 auditoriums:\n\n${titles
              .map((m) => `• ${m.title} (${m.durationMins}m, ${m.certification}) — ${m.genres.slice(0, 2).join(", ")}`)
              .join("\n")}`,
            options: [
              { label: "Browse All Movies", action: () => { setOpen(false); navigate("/movies"); } },
            ],
          };
        } catch {
          reply = {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: "CINE 360 features blockbuster releases in IMAX, 3D, and 2D formats with real-time seat availability.",
            options: [{ label: "View Movies", action: () => { setOpen(false); navigate("/movies"); } }],
          };
        }
      } else if (q.includes("seatvision") || q.includes("3d") || q.includes("angle") || q.includes("view")) {
        reply = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "📐 **SeatVision** is our physical sightline engine. When you select a seat in our 3D auditorium:\n1. Camera positions at the exact calibrated eye-height (1.15m).\n2. Computes 3D distance to screen center in meters.\n3. Calculates horizontal & vertical viewing angles based on SMPTE/THX standards.\n4. Gives you a derived 0-100 sightline clarity score so you never get a bad seat!",
          options: [
            { label: "Try 3D Seat Explorer", action: () => { setOpen(false); navigate("/movies"); } },
          ],
        };
      } else if (q.includes("category") || q.includes("price") || q.includes("cost") || q.includes("tier")) {
        reply = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "🎟️ **Seat Categories in CINE 360**:\n• **SILVER**: Front rows, wide immersive view (Base ~₹180).\n• **GOLD**: Prime middle rows, balanced SMPTE viewing angle (Base ~₹250).\n• **RECLINER**: Back row plush motorized loungers with extra legroom (Base ~₹450).\n• **ACCESSIBLE**: Dedicated wheelchair spaces in rows C & D.",
        };
      } else if (q.includes("theatre") || q.includes("location") || q.includes("where")) {
        try {
          const res = await api.get<{ theatres: any[] }>("/api/theatres");
          const names = res.theatres.map((t) => `• **${t.name}** — ${t.city} (${t.address})`);
          reply = {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: `We have the following verified cinema venues in the network:\n\n${names.join("\n")}`,
            options: [
              { label: "Explore Theatres", action: () => { setOpen(false); navigate("/theatres"); } },
            ],
          };
        } catch {
          reply = {
            id: (Date.now() + 1).toString(),
            sender: "ai",
            text: "CINE 360 partners with premier venues like Frost Cinemas (Anna Nagar, Chennai) and Flame Multiplex equipped with Dolby Atmos and 4K Laser projection.",
            options: [{ label: "View Theatres", action: () => { setOpen(false); navigate("/theatres"); } }],
          };
        }
      } else if (q.includes("hold") || q.includes("book") || q.includes("double") || q.includes("ticket")) {
        reply = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "🔒 **Guaranteed Booking Integrity**:\nWhen you select seats and proceed to checkout, our database acquires an atomic 5-minute transactional hold. Even if multiple users click the same chair simultaneously, our concurrency engine guarantees exactly 1 winner. Unpaid holds expire automatically and return to inventory.",
        };
      } else {
        reply = {
          id: (Date.now() + 1).toString(),
          sender: "ai",
          text: "I can help you explore films, find the best viewing seats with our 3D sightline engine, and review ticket options. What would you like to check?",
          options: [
            { label: "🎬 Show Movies", action: () => handlePrompt("What movies are currently showing?") },
            { label: "📐 Explain SeatVision", action: () => handlePrompt("How does 3D SeatVision work?") },
            { label: "📍 View Theatres", action: () => handlePrompt("Where are the theatres located?") },
          ],
        };
      }

      setMessages((prev) => [...prev, reply]);
      setBusy(false);
    }, 400);
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-[#F59E0B] via-[#D97706] to-[#B45309] text-slate-950 font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all cursor-pointer text-sm border border-amber-300/30 group shadow-amber-500/20"
          aria-label="Open CINE AI Assistant"
        >
          <span className="w-6 h-6 rounded-full bg-black/20 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-slate-950 animate-pulse" />
          </span>
          <span>Ask CINE AI</span>
        </button>
      ) : (
        <div className="w-[360px] sm:w-[400px] h-[520px] rounded-2xl bg-[#090B10]/98 border border-white/15 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in-0 zoom-in-95">
          {/* Header */}
          <div className="p-3.5 border-b border-white/10 bg-[#0F1117] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#F59E0B] to-[#D97706] flex items-center justify-center text-slate-950 font-bold">
                <Bot className="w-4 h-4" />
              </span>
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-1.5">
                  CINE AI <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#F59E0B]/20 text-[#F59E0B] font-mono">ASSISTANT</span>
                </div>
                <div className="text-[11px] text-[#94A3B8]">Deterministic Cinema Intelligence</div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label="Close assistant"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 leading-relaxed ${
                    m.sender === "user"
                      ? "bg-gradient-to-r from-[#F59E0B] to-[#D97706] text-slate-950 font-medium rounded-br-none"
                      : "bg-[#141722] text-[#E2E8F0] border border-white/10 rounded-bl-none whitespace-pre-line"
                  }`}
                >
                  {m.text}
                </div>
                {m.options && m.options.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                    {m.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={opt.action}
                        className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-[#F59E0B]/20 border border-white/10 text-[11px] text-[#CBD5E1] hover:text-[#FBBF24] hover:border-[#F59E0B]/40 transition-colors cursor-pointer"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-2 text-xs text-[#94A3B8] p-2">
                <span className="w-2 h-2 rounded-full bg-[#F59E0B] animate-ping" />
                Thinking…
              </div>
            )}
          </div>

          {/* Input Box */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handlePrompt(input);
            }}
            className="p-2.5 border-t border-white/10 bg-[#0A0C11] flex items-center gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about movies, seats, sightlines…"
              className="bg-[#141722] border-white/10 text-white placeholder:text-[#64748B] text-xs h-9 focus-visible:ring-[#F59E0B]"
            />
            <Button
              type="submit"
              size="sm"
              disabled={busy || !input.trim()}
              className="bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 font-bold h-9 px-3 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
