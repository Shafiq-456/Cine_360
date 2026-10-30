"use client";
// Owner: theatre registration + profile management.
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge, Spinner } from "../bits";
import { toast } from "sonner";
import { Plus, Building2 } from "lucide-react";

type Theatre = {
  id: string; name: string; city: string; address: string; status: string; amenities: string;
  auditoriums: { id: string; name: string; _count: { seats: number; shows: number } }[];
};

export default function OwnerTheatres() {
  const [theatres, setTheatres] = useState<Theatre[] | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", address: "", amenities: "Dolby Atmos, Parking" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api.get<{ theatres: Theatre[] }>("/api/owner/theatres").then((d) => setTheatres(d.theatres)).catch(() => setTheatres([]));
  }, []);
  useEffect(load, [load]);

  const create = async () => {
    setBusy(true);
    try {
      await api.post("/api/owner/theatres", {
        name: form.name,
        city: form.city,
        address: form.address,
        amenities: form.amenities.split(",").map((a) => a.trim()).filter(Boolean),
      });
      toast.success("Theatre registered — awaiting super-admin approval before it appears publicly.");
      setOpen(false);
      setForm({ name: "", city: "", address: "", amenities: "Dolby Atmos, Parking" });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not register theatre");
    } finally {
      setBusy(false);
    }
  };

  if (!theatres) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Your theatres</h2>
        <Button className="bg-[#477BFF] hover:bg-[#5C89FF]" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4 mr-1.5" /> Register theatre
        </Button>
      </div>

      {theatres.length === 0 && (
        <div className="cine-card p-10 text-center text-[#8FA3BF]">
          <Building2 className="w-8 h-8 mx-auto mb-3 text-[#477BFF]/50" />
          No theatres yet. Register your first venue to add auditoriums and schedule shows.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {theatres.map((t) => (
          <div key={t.id} className="cine-card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{t.name}</h3>
                <p className="text-xs text-[#8FA3BF] mt-0.5">{t.address}</p>
              </div>
              <StatusBadge status={t.status} />
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {t.auditoriums.map((a) => (
                <span key={a.id} className="text-[11px] px-2 py-1 rounded-md bg-white/5 border border-white/10 text-[#B9C4D6]">
                  {a.name} · {a._count.seats} seats · {a._count.shows} shows
                </span>
              ))}
              {t.auditoriums.length === 0 && <span className="text-[11px] text-[#8FA3BF]">No auditoriums yet — add one in the Auditoriums tab.</span>}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#101218] border-white/10">
          <DialogHeader>
            <DialogTitle>Register a theatre</DialogTitle>
            <DialogDescription>New theatres start as PENDING and appear publicly once a platform admin approves them.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="t-name">Name</Label>
              <Input id="t-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-[#0B0D12]" placeholder="Frost Cinemas — Velachery" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-city">City</Label>
              <Input id="t-city" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="bg-[#0B0D12]" placeholder="Chennai" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-addr">Address</Label>
              <Input id="t-addr" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-[#0B0D12]" placeholder="100 Feet Road, Velachery" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-amen">Amenities (comma separated)</Label>
              <Input id="t-amen" value={form.amenities} onChange={(e) => setForm({ ...form, amenities: e.target.value })} className="bg-[#0B0D12]" />
            </div>
            <Button className="w-full bg-[#477BFF] hover:bg-[#5C89FF]" disabled={busy || form.name.length < 3 || form.city.length < 2 || form.address.length < 6} onClick={create}>
              {busy ? "Registering…" : "Register theatre"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
