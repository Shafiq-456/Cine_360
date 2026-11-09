"use client";
// CINE 360 — single-route SPA shell with hash-based routing.
// The sandbox preview exposes only `/`, so the whole product lives here with
// deep-linkable hash routes (#/movies/abc, #/book/showId, #/owner, #/admin…).
import { useEffect } from "react";
import { motion } from "framer-motion";
import { useRoute, navigate } from "@/lib/router";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Clapperboard, Film, MapPin, Ticket, LogIn, LogOut, LayoutDashboard, ShieldCheck, ScanLine, Building2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client";

import HomeView from "@/components/cine/views/HomeView";
import MoviesView from "@/components/cine/views/MoviesView";
import MovieDetailView from "@/components/cine/views/MovieDetailView";
import TheatresView from "@/components/cine/views/TheatresView";
import TheatreDetailView from "@/components/cine/views/TheatreDetailView";
import BookView from "@/components/cine/views/BookView";
import CheckoutView from "@/components/cine/views/CheckoutView";
import TicketsView from "@/components/cine/views/TicketsView";
import TicketDetailView from "@/components/cine/views/TicketDetailView";
import LoginView from "@/components/cine/views/LoginView";
import OwnerView from "@/components/cine/views/OwnerView";
import AdminView from "@/components/cine/views/AdminView";
import ScanView from "@/components/cine/views/ScanView";
import { Spinner } from "@/components/cine/views/bits";

function View({ path, params }: { path: string; params: URLSearchParams }) {
  const seg = path.split("/").filter(Boolean);
  const [head, a] = seg;
  switch (head) {
    case undefined:
      return <HomeView />;
    case "movies":
      return a ? <MovieDetailView id={a} /> : <MoviesView params={params} />;
    case "theatres":
      return a ? <TheatreDetailView id={a} /> : <TheatresView params={params} />;
    case "book":
      return a ? <BookView showId={a} params={params} /> : <MoviesView params={params} />;
    case "checkout":
      return a ? <CheckoutView bookingId={a} /> : <TicketsView />;
    case "tickets":
      return a ? <TicketDetailView id={a} /> : <TicketsView />;
    case "login":
    case "register":
      return <LoginView mode={head === "login" ? "login" : "register"} />;
    case "owner":
      return <OwnerView params={params} />;
    case "admin":
      return <AdminView params={params} />;
    case "scan":
      return <ScanView />;
    default:
      return <NotFound />;
  }
}

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-32 gap-4 text-center px-6">
      <div className="text-6xl">🎬</div>
      <h1 className="text-2xl font-semibold">This reel doesn&apos;t exist</h1>
      <p className="text-muted-foreground max-w-md">The page you are looking for was moved, removed, or never screened.</p>
      <Button onClick={() => navigate("/")}>Back to CINE 360</Button>
    </div>
  );
}

function Nav({ path }: { path: string }) {
  const { session, loadSession } = useAuth();

  const logout = async () => {
    try {
      await api.post("/api/auth/logout");
      await loadSession();
      toast.success("Signed out");
      navigate("/");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Logout failed");
    }
  };

  const link = (to: string, label: string, icon: React.ReactNode) => {
    const active = path === to || (to !== "/" && path.startsWith(to));
    return (
      <button
        onClick={() => navigate(to)}
        aria-current={active ? "page" : undefined}
        className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors group ${
          active ? "text-white" : "text-[#B4A6D4] hover:text-white"
        }`}
      >
        {active && (
          <span
            aria-hidden="true"
            className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#8B5CF6]/35 via-[#8B5CF6]/20 to-[#F0659A]/30 border border-[#8B5CF6]/40 cine-glow-blue"
          />
        )}
        <span className="relative flex items-center gap-1.5 group-hover:-translate-y-px transition-transform">
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </span>
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#120A1C]/80 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5 group cursor-pointer" aria-label="CINE 360 home">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8B5CF6] to-[#F2B04C] flex items-center justify-center cine-glow-blue group-hover:scale-105 transition-transform">
            <Clapperboard className="w-5 h-5 text-white" />
          </span>
          <span className="text-lg font-bold tracking-wide">
            CINE<span className="cine-flame-text">360</span>
          </span>
        </button>

        <nav className="flex items-center gap-1" aria-label="Primary">
          {link("/movies", "Movies", <Film className="w-4 h-4" />)}
          {link("/theatres", "Theatres", <MapPin className="w-4 h-4" />)}
          {session && link("/tickets", "My Tickets", <Ticket className="w-4 h-4" />)}
        </nav>

        <div className="flex items-center gap-2">
          {session ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full pl-1 pr-2 py-1 hover:bg-white/5 transition-colors cursor-pointer" aria-label="Account menu">
                  <Avatar className="w-8 h-8 border border-[#8B5CF6]/40">
                    <AvatarFallback className="bg-[#2A1B45] text-[#C4B5FD] text-xs font-semibold">
                      {session.name.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <ChevronDown className="w-3.5 h-3.5 text-[#B4A6D4]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-[#1E1230] border-white/10">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{session.name}</div>
                  <div className="text-xs text-muted-foreground">{session.email} · {session.role}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/tickets")} className="cursor-pointer">
                  <Ticket className="w-4 h-4 mr-2" /> My Tickets
                </DropdownMenuItem>
                {session.role === "OWNER" && (
                  <DropdownMenuItem onClick={() => navigate("/owner")} className="cursor-pointer">
                    <Building2 className="w-4 h-4 mr-2" /> Owner Console
                  </DropdownMenuItem>
                )}
                {session.role === "ADMIN" && (
                  <DropdownMenuItem onClick={() => navigate("/admin")} className="cursor-pointer">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Super Admin
                  </DropdownMenuItem>
                )}
                {["STAFF", "OWNER", "ADMIN"].includes(session.role) && (
                  <DropdownMenuItem onClick={() => navigate("/scan")} className="cursor-pointer">
                    <ScanLine className="w-4 h-4 mr-2" /> Ticket Scanner
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} className="cursor-pointer text-[#E5484D] focus:text-[#E5484D]">
                  <LogOut className="w-4 h-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" onClick={() => navigate("/login")} className="bg-[#8B5CF6] hover:bg-[#A78BFA] text-white gap-1.5">
              <LogIn className="w-3.5 h-3.5" /> Sign in
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 bg-[#0D0716]">
      <div className="max-w-7xl mx-auto px-4 py-10 grid gap-8 md:grid-cols-3 text-sm">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#8B5CF6] to-[#F2B04C] flex items-center justify-center">
              <Clapperboard className="w-4 h-4 text-white" />
            </span>
            <span className="font-bold">CINE<span className="cine-flame-text">360</span></span>
          </div>
          <p className="text-[#B4A6D4] leading-relaxed">
            Don&apos;t just book a seat. Experience it before you sit. Explore 3D auditoriums, preview your exact view and book with confidence.
          </p>
          <p className="mt-4 text-xs text-[#B4A6D4]/70">
            DEMO BUILD — test-mode payments, procedural demo geometry and clearly labelled demo accounts.
          </p>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Explore</h3>
          <ul className="space-y-2 text-[#B4A6D4]">
            <li><button className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/movies")}>All movies</button></li>
            <li><button className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/theatres")}>Theatres</button></li>
            <li><button className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/tickets")}>My tickets</button></li>
            <li><button className="hover:text-white transition-colors cursor-pointer" onClick={() => navigate("/login")}>Demo accounts</button></li>
          </ul>
        </div>
        <div>
          <h3 className="font-semibold mb-3">Built by FROST &amp; FLAME</h3>
          <p className="text-[#B4A6D4]">Mohammed Shafiq AS · Jaiyanth B</p>
          <p className="mt-2 text-[#B4A6D4]">Your Cinema. Your View. Your Seat.</p>
        </div>
      </div>
      <div className="border-t border-white/5 py-4 text-center text-xs text-[#B4A6D4]/60">
        © {new Date().getFullYear()} CINE 360 · Immersive 3D Cinema Ticket Booking
      </div>
    </footer>
  );
}

export default function CineApp() {
  const { path, params } = useRoute();
  const { loadSession, sessionLoaded } = useAuth();

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [path]);

  return (
    <div className="min-h-screen flex flex-col bg-[#120A1C]">
      <Nav path={path} />
      <motion.main
        key={path}
        className="flex-1"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        {sessionLoaded ? (
          <View path={path} params={params} />
        ) : (
          <div className="flex items-center justify-center py-40"><Spinner label="Loading CINE 360" /></div>
        )}
      </motion.main>
      <Footer />
    </div>
  );
}
