"use client";
// Super-Admin dashboard — platform governance. All APIs enforce ADMIN role.
import { useCallback, useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api, inr, fmtDateTime } from "@/lib/client";
import { useAuth } from "@/lib/store";
import { MetricCard, Spinner, EmptyState, StatusBadge, PageTitle } from "./bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ShieldCheck, Check, Ban, X, RotateCcw, Plus, ScrollText, Settings2 } from "lucide-react";

type Tab = "overview" | "theatres" | "users" | "movies" | "bookings" | "settings" | "audit";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "theatres", label: "Theatres" },
  { key: "users", label: "Users" },
  { key: "movies", label: "Movies" },
  { key: "bookings", label: "Bookings" },
  { key: "settings", label: "Settings" },
  { key: "audit", label: "Audit logs" },
];

export default function AdminView({ params }: { params: URLSearchParams }) {
  const { session, sessionLoaded } = useAuth();
  // The URL is the single source of truth for the active tab (deep-linkable)
  const paramTab = params.get("tab");
  const tab: Tab = TABS.some((x) => x.key === paramTab) ? (paramTab as Tab) : "overview";

  useEffect(() => {
    if (sessionLoaded && session && session.role !== "ADMIN") {
      toast.error("Super-admin access only.");
      navigate("/");
    }
  }, [session, sessionLoaded]);

  if (!sessionLoaded) return <div className="py-32 flex justify-center"><Spinner /></div>;
  if (!session || session.role !== "ADMIN") {
    return <EmptyState icon={<ShieldCheck className="w-6 h-6" />} title="Super-admin access only" hint="Sign in with the admin demo account from the sign-in page." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <PageTitle title="Platform Administration" subtitle="Approvals, catalogue, monitoring, refunds, commission and audit trail." />
      <div className="flex flex-wrap gap-1.5 mb-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); navigate(`/admin?tab=${t.key}`, { replace: true }); }}
            className={`px-3.5 py-2 rounded-lg text-sm border transition-colors cursor-pointer ${tab === t.key ? "bg-[#477BFF] border-[#477BFF] text-white" : "border-white/10 text-[#8FA3BF] hover:text-white hover:border-[#477BFF]/40"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview />}
      {tab === "theatres" && <Theatres />}
      {tab === "users" && <Users />}
      {tab === "movies" && <Movies />}
      {tab === "bookings" && <Bookings />}
      {tab === "settings" && <Settings />}
      {tab === "audit" && <Audit />}
    </div>
  );
}

/* ---------------- Overview ---------------- */
type Metrics = {
  users: number; customers: number; owners: number; staff: number;
  theatres: number; pendingTheatres: number; approvedTheatres: number;
  movies: number; shows: number; bookings: number; confirmedBookings: number;
  grossRevenue: number; platformCommission: number; commissionPercent: number;
};
function Overview() {
  const [m, setM] = useState<Metrics | null>(null);
  useEffect(() => {
    api.get<Metrics>("/api/admin/overview").then(setM).catch(() => setM({} as Metrics));
  }, []);
  if (!m) return <Spinner label="Loading platform metrics…" />;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard label="Users" value={m.users} hint={`${m.customers} customers · ${m.owners} owners · ${m.staff} staff`} />
        <MetricCard label="Theatres" value={m.theatres} hint={`${m.approvedTheatres} approved · ${m.pendingTheatres} pending`} accent={m.pendingTheatres > 0 ? "#F5C518" : "#477BFF"} />
        <MetricCard label="Movies" value={m.movies} accent="#20D9E8" />
        <MetricCard label="Scheduled shows" value={m.shows} accent="#F5C518" />
        <MetricCard label="Bookings" value={m.bookings} hint={`${m.confirmedBookings} confirmed`} />
        <MetricCard label="Gross revenue" value={inr(m.grossRevenue)} hint={`Platform commission (${m.commissionPercent}%): ${inr(m.platformCommission)}`} accent="#2FBF71" />
      </div>
      {m.pendingTheatres > 0 && (
        <div className="cine-card p-4 border-[#F5C518]/30 flex items-center justify-between">
          <span className="text-sm">{m.pendingTheatres} theatre registration{m.pendingTheatres === 1 ? "" : "s"} awaiting approval.</span>
          <Button size="sm" className="bg-[#F5C518] text-black hover:bg-[#FFD34D]" onClick={() => document.getElementById("goto-theatres")?.scrollIntoView()}>
            Review in Theatres tab
          </Button>
        </div>
      )}
    </div>
  );
}

/* ---------------- Theatres ---------------- */
type AdminTheatre = {
  id: string; name: string; city: string; address: string; status: string;
  owner: { name: string; email: string };
  auditoriums: { id: string; name: string; _count: { seats: number; shows: number } }[];
};
function Theatres() {
  const [theatres, setTheatres] = useState<AdminTheatre[] | null>(null);
  const load = useCallback(() => {
    api.get<{ theatres: AdminTheatre[] }>("/api/admin/theatres").then((d) => setTheatres(d.theatres)).catch(() => setTheatres([]));
  }, []);
  useEffect(load, [load]);

  const setStatus = async (theatreId: string, status: string) => {
    try {
      await api.patch("/api/admin/theatres", { theatreId, status });
      toast.success(`Theatre ${status.toLowerCase()}.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  if (!theatres) return <Spinner />;
  return (
    <div id="goto-theatres" className="space-y-3">
      {theatres.map((t) => (
        <div key={t.id} className="cine-card p-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold">{t.name}</h3>
              <StatusBadge status={t.status} />
            </div>
            <p className="text-xs text-[#8FA3BF] mt-0.5">{t.city} · {t.address}</p>
            <p className="text-xs text-[#8FA3BF]">Owner: {t.owner.name} ({t.owner.email})</p>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {t.auditoriums.map((a) => (
                <span key={a.id} className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[#B9C4D6]">{a.name} · {a._count.seats} seats · {a._count.shows} shows</span>
              ))}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {t.status !== "APPROVED" && (
              <Button size="sm" className="bg-[#2FBF71] hover:bg-[#3BD482] text-black" onClick={() => setStatus(t.id, "APPROVED")}><Check className="w-3.5 h-3.5 mr-1" /> Approve</Button>
            )}
            {t.status === "APPROVED" && (
              <Button size="sm" variant="outline" className="border-[#FF713D]/40 text-[#FF713D]" onClick={() => setStatus(t.id, "SUSPENDED")}><Ban className="w-3.5 h-3.5 mr-1" /> Suspend</Button>
            )}
            {t.status === "PENDING" && (
              <Button size="sm" variant="outline" className="border-[#E5484D]/40 text-[#E5484D]" onClick={() => setStatus(t.id, "REJECTED")}><X className="w-3.5 h-3.5 mr-1" /> Reject</Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Users ---------------- */
type AdminUser = { id: string; name: string; email: string; role: string; status: string; createdAt: string; _count: { bookings: number; theatres: number } };
function Users() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [role, setRole] = useState("");
  const load = useCallback(() => {
    api.get<{ users: AdminUser[] }>(`/api/admin/users?role=${role}`).then((d) => setUsers(d.users)).catch(() => setUsers([]));
  }, [role]);
  useEffect(load, [load]);

  const toggle = async (u: AdminUser) => {
    try {
      await api.patch("/api/admin/users", { userId: u.id, status: u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE" });
      toast.success(`${u.name} ${u.status === "ACTIVE" ? "deactivated" : "reactivated"}.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  if (!users) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex gap-1.5">
        {["", "CUSTOMER", "OWNER", "STAFF", "ADMIN"].map((r) => (
          <button key={r || "all"} onClick={() => setRole(r)} className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${role === r ? "bg-[#477BFF] border-[#477BFF] text-white" : "border-white/10 text-[#8FA3BF] hover:text-white"}`}>
            {r || "All roles"}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto cine-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#8FA3BF] uppercase tracking-wider">
              <th className="p-4 font-medium">User</th>
              <th className="p-4 font-medium">Role</th>
              <th className="p-4 font-medium">Bookings</th>
              <th className="p-4 font-medium">Theatres</th>
              <th className="p-4 font-medium">Joined</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-white/5">
                <td className="p-4">{u.name}<div className="text-xs text-[#8FA3BF]">{u.email}</div></td>
                <td className="p-4"><StatusBadge status={u.role} /></td>
                <td className="p-4">{u._count.bookings}</td>
                <td className="p-4">{u._count.theatres}</td>
                <td className="p-4 text-xs text-[#8FA3BF]">{fmtDateTime(u.createdAt)}</td>
                <td className="p-4"><StatusBadge status={u.status} /></td>
                <td className="p-4">
                  {u.role !== "ADMIN" && (
                    <Button size="sm" variant="outline" className={`h-7 ${u.status === "ACTIVE" ? "border-[#E5484D]/40 text-[#E5484D]" : "border-[#2FBF71]/40 text-[#2FBF71]"}`} onClick={() => toggle(u)}>
                      {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------- Movies ---------------- */
type AdminMovie = { id: string; title: string; slug: string; status: string; featured: boolean; genres: string[]; languages: string[]; durationMins: number; _count: { shows: number } };
function Movies() {
  const [movies, setMovies] = useState<AdminMovie[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", synopsis: "", languages: "English", genres: "Action", durationMins: 120, certification: "UA" });
  const load = useCallback(() => {
    api.get<{ movies: AdminMovie[] }>("/api/admin/movies").then((d) => setMovies(d.movies)).catch(() => setMovies([]));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    try {
      await api.post("/api/admin/movies", {
        title: form.title,
        synopsis: form.synopsis,
        languages: form.languages.split(",").map((s) => s.trim()).filter(Boolean),
        genres: form.genres.split(",").map((s) => s.trim()).filter(Boolean),
        durationMins: Number(form.durationMins),
        certification: form.certification,
        status: "NOW_SHOWING",
        featured: false,
      });
      toast.success("Movie added to the catalogue.");
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add movie");
    }
  };

  const patch = async (id: string, data: Record<string, unknown>) => {
    try {
      await api.patch(`/api/admin/movies/${id}`, data);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const remove = async (m: AdminMovie) => {
    try {
      const r = await api.del<{ deleted?: boolean; archived?: boolean }>(`/api/admin/movies/${m.id}`);
      toast.success(r.deleted ? "Movie deleted." : "Movie has shows — archived instead.");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  if (!movies) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Movie catalogue</h2>
        <Button className="bg-[#477BFF] hover:bg-[#5C89FF]" onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1.5" /> Add movie</Button>
      </div>
      <div className="overflow-x-auto cine-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-[#8FA3BF] uppercase tracking-wider">
              <th className="p-4 font-medium">Title</th>
              <th className="p-4 font-medium">Meta</th>
              <th className="p-4 font-medium">Shows</th>
              <th className="p-4 font-medium">Status</th>
              <th className="p-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {movies.map((m) => (
              <tr key={m.id} className="border-t border-white/5">
                <td className="p-4 font-medium">{m.title}{m.featured && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-[#FF713D]/15 text-[#FF713D] border border-[#FF713D]/30">FEATURED</span>}</td>
                <td className="p-4 text-xs text-[#8FA3BF]">{m.durationMins} min · {m.languages.join(", ")} · {m.genres.slice(0, 3).join(", ")}</td>
                <td className="p-4">{m._count.shows}</td>
                <td className="p-4"><StatusBadge status={m.status} /></td>
                <td className="p-4">
                  <div className="flex gap-1.5 flex-wrap">
                    <Button size="sm" variant="outline" className="h-7 border-white/15 text-xs" onClick={() => patch(m.id, { featured: !m.featured })}>{m.featured ? "Unfeature" : "Feature"}</Button>
                    <Button size="sm" variant="outline" className="h-7 border-white/15 text-xs" onClick={() => patch(m.id, { status: m.status === "NOW_SHOWING" ? "UPCOMING" : "NOW_SHOWING" })}>
                      {m.status === "NOW_SHOWING" ? "Move to upcoming" : "Set now showing"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 border-[#E5484D]/40 text-[#E5484D]" onClick={() => remove(m)}>Delete</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#101218] border-white/10">
          <DialogHeader>
            <DialogTitle>Add a movie</DialogTitle>
            <DialogDescription>Demo artwork is applied automatically (procedural poster). Real poster uploads belong in the production asset pipeline.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            {([["title", "Title"], ["synopsis", "Synopsis (10+ chars)"], ["languages", "Languages (comma sep)"], ["genres", "Genres (comma sep)"], ["certification", "Certification (UA)"]] as const).map(([k, label]) => (
              <div key={k} className="space-y-1.5">
                <Label>{label}</Label>
                {k === "synopsis" ? (
                  <textarea value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} rows={3} className="w-full rounded-md bg-[#0B0D12] border border-white/10 px-3 py-2 text-sm" />
                ) : (
                  <Input value={String(form[k])} onChange={(e) => setForm({ ...form, [k]: e.target.value })} className="bg-[#0B0D12]" />
                )}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label>Duration (minutes)</Label>
              <Input type="number" value={form.durationMins} onChange={(e) => setForm({ ...form, durationMins: Number(e.target.value) })} className="bg-[#0B0D12]" />
            </div>
            <Button className="w-full bg-[#477BFF] hover:bg-[#5C89FF]" onClick={create} disabled={form.title.length < 1 || form.synopsis.length < 10}>Add movie</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------------- Bookings + refunds ---------------- */
type AdminBooking = {
  id: string; reference: string; status: string; totalAmount: number; createdAt: string;
  user: { name: string; email: string };
  seats: { rowLabel: string; seatNumber: number }[];
  payment?: { status: string; provider: string; orderId: string } | null;
  show: { startsAt: string; movie: { title: string }; auditorium: { name: string; theatre: { name: string } } };
};
function Bookings() {
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [status, setStatus] = useState("CONFIRMED");
  const load = useCallback(() => {
    api.get<{ bookings: AdminBooking[] }>(`/api/admin/bookings?status=${status}`).then((d) => setBookings(d.bookings)).catch(() => setBookings([]));
  }, [status]);
  useEffect(load, [load]);

  const refund = async (b: AdminBooking) => {
    try {
      await api.post("/api/admin/refunds", { bookingId: b.id });
      toast.success(`Refunded ${b.reference} — seats released, tickets voided.`);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refund failed");
    }
  };

  if (!bookings) return <Spinner />;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold">Bookings &amp; refunds</h2>
        <div className="flex gap-1.5 flex-wrap">
          {["CONFIRMED", "PENDING_PAYMENT", "CANCELLED", "REFUNDED", ""].map((s) => (
            <button key={s || "all"} onClick={() => setStatus(s)} className={`px-3 py-1.5 rounded-lg text-xs border cursor-pointer ${status === s ? "bg-[#477BFF] border-[#477BFF] text-white" : "border-white/10 text-[#8FA3BF] hover:text-white"}`}>
              {s || "All"}
            </button>
          ))}
        </div>
      </div>
      {bookings.length === 0 ? (
        <EmptyState title="No bookings in this filter" />
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
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id} className="border-t border-white/5">
                  <td className="p-4 font-mono text-xs">{b.reference}</td>
                  <td className="p-4">{b.user.name}<div className="text-xs text-[#8FA3BF]">{b.user.email}</div></td>
                  <td className="p-4">{b.show.movie.title}<div className="text-xs text-[#8FA3BF]">{b.show.auditorium.theatre.name} · {fmtDateTime(b.show.startsAt)}</div></td>
                  <td className="p-4 text-xs">{b.seats.map((s) => `${s.rowLabel}${s.seatNumber}`).join(", ")}</td>
                  <td className="p-4">{inr(b.totalAmount)}</td>
                  <td className="p-4 text-xs">{b.payment ? `${b.payment.status} · ${b.payment.provider}` : "—"}</td>
                  <td className="p-4"><StatusBadge status={b.status} /></td>
                  <td className="p-4">
                    {b.status === "CONFIRMED" && (
                      <Button size="sm" variant="outline" className="h-7 border-[#FF713D]/40 text-[#FF713D]" onClick={() => refund(b)}>
                        <RotateCcw className="w-3 h-3 mr-1" /> Refund
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------------- Settings ---------------- */
function Settings() {
  const [percent, setPercent] = useState<string>("8");
  const [saved, setSaved] = useState<number | null>(null);
  useEffect(() => {
    api.get<{ settings: Record<string, string> }>("/api/admin/settings").then((d) => setPercent(d.settings["platform.commissionPercent"] || "8")).catch(() => {});
  }, []);
  const save = async () => {
    try {
      const r = await api.patch<{ commissionPercent: number }>("/api/admin/settings", { commissionPercent: Number(percent) });
      setSaved(r.commissionPercent);
      toast.success(`Platform commission set to ${r.commissionPercent}%.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    }
  };
  return (
    <div className="cine-card p-6 max-w-md space-y-4">
      <h2 className="font-semibold flex items-center gap-2"><Settings2 className="w-4 h-4 text-[#477BFF]" /> Platform settings</h2>
      <div className="space-y-1.5">
        <Label>Commission on owner revenue (%)</Label>
        <Input type="number" min={0} max={30} value={percent} onChange={(e) => setPercent(e.target.value)} className="bg-[#0B0D12]" />
      </div>
      <Button className="bg-[#477BFF] hover:bg-[#5C89FF]" onClick={save}>Save settings</Button>
      {saved !== null && <p className="text-xs text-[#2FBF71]">Saved: owner analytics now show net revenue after {saved}% commission.</p>}
      <p className="text-[11px] text-[#8FA3BF]">Commission is applied in owner analytics and the admin overview. Payment gateway fees are out of scope for the demo ledger.</p>
    </div>
  );
}

/* ---------------- Audit logs ---------------- */
type AuditRow = { id: string; action: string; entity: string; entityId: string | null; actorEmail: string | null; meta: string; createdAt: string };
function Audit() {
  const [logs, setLogs] = useState<AuditRow[] | null>(null);
  useEffect(() => {
    api.get<{ logs: AuditRow[] }>("/api/admin/audit-logs").then((d) => setLogs(d.logs)).catch(() => setLogs([]));
  }, []);
  if (!logs) return <Spinner />;
  return (
    <div className="cine-card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-[#8FA3BF] uppercase tracking-wider">
            <th className="p-4 font-medium">Time</th>
            <th className="p-4 font-medium">Actor</th>
            <th className="p-4 font-medium">Action</th>
            <th className="p-4 font-medium">Entity</th>
            <th className="p-4 font-medium">Meta</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id} className="border-t border-white/5">
              <td className="p-4 text-xs whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
              <td className="p-4 text-xs">{l.actorEmail || "system"}</td>
              <td className="p-4 font-medium"><span className="flex items-center gap-1.5"><ScrollText className="w-3 h-3 text-[#20D9E8]" />{l.action}</span></td>
              <td className="p-4 text-xs">{l.entity}{l.entityId ? ` · ${l.entityId.slice(0, 10)}…` : ""}</td>
              <td className="p-4 text-xs text-[#8FA3BF] font-mono max-w-[280px] truncate">{l.meta}</td>
            </tr>
          ))}
          {logs.length === 0 && (
            <tr><td colSpan={5} className="p-8 text-center text-[#8FA3BF]">No audit events yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
