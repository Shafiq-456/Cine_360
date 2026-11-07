"use client";
// Owner: staff account management (scoped to own theatres).
import { useCallback, useEffect, useState } from "react";
import { api, fmtDateTime } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge, Spinner, EmptyState } from "../bits";
import { toast } from "sonner";
import { UserPlus, ScanLine } from "lucide-react";

type StaffRow = {
  id: string;
  user: { id: string; name: string; email: string; status: string; createdAt: string };
  theatre: { id: string; name: string };
};

export default function OwnerStaff() {
  const [staff, setStaff] = useState<StaffRow[] | null>(null);
  const [theatres, setTheatres] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", theatreId: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<{ staff: StaffRow[] }>("/api/owner/staff").then((d) => setStaff(d.staff)).catch(() => setStaff([]));
  }, []);

  useEffect(() => {
    load();
    api.get<{ theatres: { id: string; name: string }[] }>("/api/owner/theatres").then((d) => {
      setTheatres(d.theatres);
      if (d.theatres[0]) setForm((f) => ({ ...f, theatreId: f.theatreId || d.theatres[0].id }));
    }).catch(() => {});
  }, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await api.post("/api/owner/staff", form);
      toast.success("Staff account created — they can sign in and open the Gate Scanner.");
      setOpen(false);
      setForm({ name: "", email: "", password: "", theatreId: form.theatreId });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create staff account");
    } finally {
      setBusy(false);
    }
  };

  if (!staff) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Gate staff</h2>
        <Button className="bg-[#8B5CF6] hover:bg-[#A78BFA]" onClick={() => setOpen(true)} disabled={theatres.length === 0}>
          <UserPlus className="w-4 h-4 mr-1.5" /> Add staff
        </Button>
      </div>

      {staff.length === 0 ? (
        <EmptyState icon={<ScanLine className="w-6 h-6" />} title="No staff yet" hint="Staff accounts can validate and redeem QR tickets at the gate." />
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {staff.map((s) => (
            <div key={s.id} className="cine-card p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-sm">{s.user.name}</div>
                <div className="text-xs text-[#B4A6D4]">{s.user.email}</div>
                <div className="text-[11px] text-[#B4A6D4] mt-1">{s.theatre.name} · joined {fmtDateTime(s.user.createdAt)}</div>
              </div>
              <StatusBadge status={s.user.status} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#1A1029] border-white/10">
          <DialogHeader>
            <DialogTitle>Add gate staff</DialogTitle>
            <DialogDescription>Creates a STAFF role account scoped to one theatre. If the email already exists (e.g. a customer), the account is upgraded and linked instead.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <Label>Theatre</Label>
              <select value={form.theatreId} onChange={(e) => setForm({ ...form, theatreId: e.target.value })} className="w-full h-9 rounded-md bg-[#150C22] border border-white/10 px-2 text-sm">
                {theatres.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#150C22]" />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="bg-[#150C22]" />
            </div>
            <div className="space-y-1.5">
              <Label>Password (min 8 chars)</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="bg-[#150C22]" minLength={8} />
            </div>
            <Button
              className="w-full bg-[#8B5CF6] hover:bg-[#A78BFA]"
              disabled={busy || !form.theatreId || form.name.length < 2 || !form.email.includes("@") || form.password.length < 8}
              onClick={create}
            >
              {busy ? "Creating…" : "Create staff account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
