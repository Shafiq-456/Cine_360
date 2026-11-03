"use client";
// Owner: Auditorium Builder — layout config, live 2D preview, seat generation,
// GLB model upload with row→node mapping and publishing.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/client";
import { generateLayout, rowLabelsFor } from "@/lib/geometry";
import type { LayoutConfig } from "@/lib/geometry";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge, Spinner } from "../bits";
import { toast } from "sonner";
import { Plus, Trash2, Upload, Save, Box, Eye, Wand2 } from "lucide-react";

type AuditoriumRow = {
  id: string; name: string; theatreId: string; layoutConfig: string; geometrySource: string; status: string;
  theatre?: { id: string; name: string; status: string };
  _count?: { seats: number; shows: number };
  models?: { id: string; kind: string; status: string; version: number; fileUrl: string | null }[];
};

type TheatreOption = { id: string; name: string; status: string };

const CATEGORY_CODES = ["SILVER", "GOLD", "RECLINER"];

function defaultLayout(): LayoutConfig {
  return {
    screen: { widthM: 12, heightM: 5, bottomY: 1.7, z: 0 },
    firstRowZ: 7.5,
    rowSpacingM: 1.1,
    rowStepUpM: 0.28,
    seatSpacingM: 0.6,
    centerAisle: true,
    aisleGapM: 1.3,
    sideMarginM: 1.5,
    eyeHeightM: 1.15,
    rows: [
      { label: "A", seats: 12, categoryCode: "SILVER" },
      { label: "B", seats: 12, categoryCode: "SILVER" },
      { label: "C", seats: 12, categoryCode: "GOLD" },
      { label: "D", seats: 12, categoryCode: "GOLD" },
      { label: "E", seats: 12, categoryCode: "GOLD" },
      { label: "F", seats: 10, categoryCode: "RECLINER" },
    ],
  };
}

/** Top-down 2D preview from live form state. */
function LayoutPreview({ layout }: { layout: LayoutConfig }) {
  const { seats, dimensions } = useMemo(() => generateLayout(layout), [layout]);
  const W = 560;
  const pad = 24;
  const scaleX = (W - pad * 2) / dimensions.widthM;
  const scaleZ = Math.min(scaleX, (260 - pad) / (dimensions.depthM || 1));
  const x = (mx: number) => pad + (mx + dimensions.widthM / 2) * scaleZ;
  const z = (mz: number) => pad + mz * scaleZ;
  const catColor: Record<string, string> = { SILVER: "#8FA3BF", GOLD: "#F5C518", RECLINER: "#FF713D" };

  return (
    <svg viewBox={`0 0 ${W} ${Math.max(200, z(dimensions.depthM) + 12)}`} className="w-full rounded-xl bg-[#0B0D12] border border-white/10" role="img" aria-label="2D layout preview">
      <rect x={x(-layout.screen.widthM / 2)} y={z(0) - 6} width={layout.screen.widthM * scaleZ} height={8} rx={3} fill="#9FC0FF" />
      <text x={W / 2} y={z(0) - 12} textAnchor="middle" fill="#8FA3BF" fontSize="10">SCREEN {layout.screen.widthM}×{layout.screen.heightM} m</text>
      {seats.map((s) => (
        <circle key={`${s.rowLabel}${s.seatNumber}`} cx={x(s.x)} cy={z(s.z)} r={Math.max(2.4, layout.seatSpacingM * scaleZ * 0.32)} fill={catColor[s.categoryCode] || "#477BFF"} opacity={0.9} />
      ))}
      {layout.centerAisle && (
        <line x1={W / 2} y1={z(layout.firstRowZ - 1)} x2={W / 2} y2={z(dimensions.lastRowZ + 1)} stroke="#20D9E8" strokeOpacity={0.25} strokeWidth={4} />
      )}
      <text x={8} y={14} fill="#20D9E8" fontSize="10">{seats.length} seats · {dimensions.widthM}×{dimensions.depthM}×{dimensions.heightM} m</text>
    </svg>
  );
}

export default function OwnerAuditoriums() {
  const [auditoriums, setAuditoriums] = useState<AuditoriumRow[] | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [theatreId, setTheatreId] = useState("");
  const [layout, setLayout] = useState<LayoutConfig>(defaultLayout());
  const [theatres, setTheatres] = useState<{ id: string; name: string; status: string }[]>([]);
  const [busy, setBusy] = useState(false);

  // model management state
  const [modelAud, setModelAud] = useState<AuditoriumRow | null>(null);
  const [nodeMap, setNodeMap] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(() => {
    api.get<{ auditoriums: AuditoriumRow[] }>("/api/owner/auditoriums").then((d) => setAuditoriums(d.auditoriums)).catch(() => setAuditoriums([]));
  }, []);

  useEffect(() => {
    load();
    api.get<{ theatres: TheatreOption[] }>("/api/owner/theatres").then((d) => setTheatres(d.theatres.filter((t) => t.status === "APPROVED"))).catch(() => {});
  }, [load]);

  const openBuilder = async (aud?: AuditoriumRow) => {
    if (aud) {
      setEditingId(aud.id);
      setName(aud.name);
      setTheatreId(aud.theatreId);
      setLayout(JSON.parse(aud.layoutConfig));
    } else {
      setEditingId(null);
      setName("");
      setLayout(defaultLayout());
      if (!theatreId && theatres.length > 0) setTheatreId(theatres[0].id);
    }
    setBuilderOpen(true);
  };

  const autoRows = () => {
    const labels = rowLabelsFor(8);
    setLayout((l) => ({
      ...l,
      rows: labels.map((label, i) => ({
        label,
        seats: 14,
        categoryCode: i < 3 ? "SILVER" : i < 6 ? "GOLD" : "RECLINER",
      })),
    }));
    toast.info("Generated 8 rows × 14 seats with a standard category split.");
  };

  const save = async () => {
    setBusy(true);
    try {
      if (editingId) {
        const r = await api.patch<{ seatCount: number }>(`/api/owner/auditoriums/${editingId}`, { name, layout });
        toast.success(`Auditorium rebuilt with ${r.seatCount} seats.`);
      } else {
        const r = await api.post<{ seatCount: number }>("/api/owner/auditoriums", { theatreId, name, layout });
        toast.success(`Auditorium created with ${r.seatCount} seats.`);
      }
      setBuilderOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save auditorium");
    } finally {
      setBusy(false);
    }
  };

  const uploadModel = async (aud: AuditoriumRow, file: File) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/owner/auditoriums/${aud.id}/model`, { method: "POST", body: fd, credentials: "same-origin" });
      const body = await res.json();
      if (!res.ok || body.ok === false) throw new Error(body.error || "Upload failed");
      toast.success("Model uploaded as DRAFT. Map rows to model nodes, then publish.");
      load();
      setModelAud(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    }
  };

  const publishModel = async (aud: AuditoriumRow, modelId: string, kind: string) => {
    try {
      await api.patch(`/api/owner/auditoriums/${aud.id}/model`, {
        modelId,
        nodeMap: kind === "UPLOADED" ? nodeMap : undefined,
        publish: true,
      });
      toast.success(kind === "UPLOADED" ? "Model published — bookings now show CALIBRATED MODEL." : "Procedural model republished.");
      setModelAud(null);
      setNodeMap({});
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Publish failed");
    }
  };

  if (!auditoriums) return <Spinner />;

  const rowLabels = layout.rows.map((r) => r.label);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Auditoriums &amp; 3D models</h2>
        <Button className="bg-[#477BFF] hover:bg-[#5C89FF]" onClick={() => openBuilder()} disabled={theatres.length === 0}>
          <Plus className="w-4 h-4 mr-1.5" /> New auditorium
        </Button>
      </div>
      {theatres.length === 0 && <p className="text-sm text-[#F5C518]">Register and get a theatre approved first (Theatres tab).</p>}

      <div className="grid md:grid-cols-2 gap-4">
        {auditoriums.map((a) => {
          const models = a.models || [];
          const published = models.find((m) => m.status === "PUBLISHED");
          return (
            <div key={a.id} className="cine-card p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold">{a.name}</h3>
                  <p className="text-xs text-[#8FA3BF] mt-0.5">{a.theatre?.name} · {a._count?.seats ?? 0} seats · {a._count?.shows ?? 0} shows</p>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${a.geometrySource === "UPLOADED" ? "border-[#2FBF71]/40 text-[#2FBF71] bg-[#2FBF71]/10" : "border-white/15 text-[#8FA3BF] bg-white/5"}`}>
                  {a.geometrySource === "UPLOADED" ? "CALIBRATED" : "DEMO GEOMETRY"}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="border-white/15 h-8" onClick={() => openBuilder(a)}>
                  <Wand2 className="w-3.5 h-3.5 mr-1" /> Edit layout
                </Button>
                <Button size="sm" variant="outline" className="border-white/15 h-8" onClick={() => { setModelAud(a); setNodeMap({}); }}>
                  <Box className="w-3.5 h-3.5 mr-1" /> 3D model ({published ? `v${published.version} published` : "none"})
                </Button>
                <Button size="sm" variant="outline" className="border-white/15 h-8" onClick={() => window.open(`/api/shows/list?auditoriumId=${a.id}`, "_blank") || undefined} title="Shows are managed in the Shows tab">
                  <Eye className="w-3.5 h-3.5 mr-1" /> {a._count?.shows ?? 0} shows
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===================== BUILDER ===================== */}
      <Dialog open={builderOpen} onOpenChange={setBuilderOpen}>
        <DialogContent className="bg-[#101218] border-white/10 max-w-4xl max-h-[90vh] overflow-y-auto cine-scroll">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit auditorium layout" : "Auditorium Builder"}</DialogTitle>
            <DialogDescription>
              Procedural geometry is generated from these dimensions. {editingId ? "Rebuilding replaces the seat map (blocked while shows are scheduled)." : "Seats are generated with calibrated eye positions for SeatVision."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-5 pt-1">
            <div className="space-y-3">
              {!editingId && (
                <div className="space-y-1.5">
                  <Label>Theatre</Label>
                  <select value={theatreId} onChange={(e) => setTheatreId(e.target.value)} className="w-full h-9 rounded-md bg-[#0B0D12] border border-white/10 px-2 text-sm" aria-label="Theatre">
                    {theatres.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Auditorium name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="bg-[#0B0D12]" placeholder="Audi 1 · Grand" />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <NumField label="Screen width (m)" value={layout.screen.widthM} onChange={(v) => setLayout({ ...layout, screen: { ...layout.screen, widthM: v } })} step={0.5} min={4} max={40} />
                <NumField label="Screen height (m)" value={layout.screen.heightM} onChange={(v) => setLayout({ ...layout, screen: { ...layout.screen, heightM: v } })} step={0.5} min={2} max={20} />
                <NumField label="Screen bottom (m)" value={layout.screen.bottomY} onChange={(v) => setLayout({ ...layout, screen: { ...layout.screen, bottomY: v } })} step={0.1} min={0.5} max={6} />
                <NumField label="First row distance (m)" value={layout.firstRowZ} onChange={(v) => setLayout({ ...layout, firstRowZ: v })} step={0.5} min={3} max={30} />
                <NumField label="Row spacing (m)" value={layout.rowSpacingM} onChange={(v) => setLayout({ ...layout, rowSpacingM: v })} step={0.05} min={0.8} max={3} />
                <NumField label="Rise per row (m)" value={layout.rowStepUpM} onChange={(v) => setLayout({ ...layout, rowStepUpM: v })} step={0.02} min={0} max={1.2} />
                <NumField label="Seat spacing (m)" value={layout.seatSpacingM} onChange={(v) => setLayout({ ...layout, seatSpacingM: v })} step={0.02} min={0.45} max={1.5} />
                <NumField label="Eye height (m)" value={layout.eyeHeightM} onChange={(v) => setLayout({ ...layout, eyeHeightM: v })} step={0.01} min={0.8} max={1.5} />
                <NumField label="Aisle width (m)" value={layout.aisleGapM} onChange={(v) => setLayout({ ...layout, aisleGapM: v })} step={0.1} min={0.6} max={4} />
                <NumField label="Side margin (m)" value={layout.sideMarginM} onChange={(v) => setLayout({ ...layout, sideMarginM: v })} step={0.1} min={0.5} max={6} />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5">
                <Label htmlFor="aisle" className="text-sm cursor-pointer">Central aisle</Label>
                <Switch id="aisle" checked={layout.centerAisle} onCheckedChange={(v) => setLayout({ ...layout, centerAisle: v })} />
              </div>

              <div className="flex items-center justify-between">
                <Label className="text-sm">Rows ({layout.rows.length})</Label>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="h-8 border-white/15 text-xs" onClick={autoRows}><Wand2 className="w-3 h-3 mr-1" /> Auto</Button>
                  <Button size="sm" variant="outline" className="h-8 border-white/15 text-xs" onClick={() => setLayout({ ...layout, rows: [...layout.rows, { label: rowLabelsFor(layout.rows.length + 1)[layout.rows.length], seats: 12, categoryCode: "GOLD" }] })}>
                    <Plus className="w-3 h-3 mr-1" /> Row
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto cine-scroll pr-1">
                {layout.rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <Input
                      value={r.label}
                      onChange={(e) => {
                        const rows = [...layout.rows];
                        rows[i] = { ...r, label: e.target.value.toUpperCase().slice(0, 3) };
                        setLayout({ ...layout, rows });
                      }}
                      className="w-14 bg-[#0B0D12] text-center text-xs"
                      aria-label={`Row ${i + 1} label`}
                    />
                    <Input
                      type="number" min={1} max={40} value={r.seats}
                      onChange={(e) => {
                        const rows = [...layout.rows];
                        rows[i] = { ...r, seats: Math.max(1, Math.min(40, Number(e.target.value) || 1)) };
                        setLayout({ ...layout, rows });
                      }}
                      className="w-20 bg-[#0B0D12] text-xs"
                      aria-label={`Row ${r.label} seat count`}
                    />
                    <select
                      value={r.categoryCode}
                      onChange={(e) => {
                        const rows = [...layout.rows];
                        rows[i] = { ...r, categoryCode: e.target.value };
                        setLayout({ ...layout, rows });
                      }}
                      className="h-9 flex-1 rounded-md bg-[#0B0D12] border border-white/10 px-2 text-xs"
                      aria-label={`Row ${r.label} category`}
                    >
                      {CATEGORY_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button
                      onClick={() => setLayout({ ...layout, rows: layout.rows.filter((_, j) => j !== i) })}
                      className="p-2 rounded-md text-[#8FA3BF] hover:text-[#E5484D] hover:bg-white/5 cursor-pointer"
                      aria-label={`Remove row ${r.label}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <LayoutPreview layout={layout} />
              <div className="text-xs text-[#8FA3BF] leading-relaxed">
                Preview is top-down. Seats are generated with per-seat coordinates (x, z, floor height, eye height) — the 3D engine and SeatVision measurements use exactly these numbers. Category colours: <span className="text-[#8FA3BF]">Silver</span> / <span className="text-[#F5C518]">Gold</span> / <span className="text-[#FF713D]">Recliner</span> (base prices are configurable per show).
              </div>
              <Button className="w-full bg-[#477BFF] hover:bg-[#5C89FF]" disabled={busy || name.length < 2 || layout.rows.length === 0 || (!editingId && !theatreId)} onClick={save}>
                <Save className="w-4 h-4 mr-2" /> {editingId ? "Rebuild auditorium" : "Create auditorium"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===================== 3D MODEL MANAGER ===================== */}
      <Dialog open={!!modelAud} onOpenChange={(v) => !v && setModelAud(null)}>
        <DialogContent className="bg-[#101218] border-white/10 max-w-2xl max-h-[85vh] overflow-y-auto cine-scroll">
          <DialogHeader>
            <DialogTitle>3D model — {modelAud?.name}</DialogTitle>
            <DialogDescription>
              Upload a GLB/glTF auditorium model (≤25 MB), map each physical row to a model node prefix, then publish. Published models label the auditorium as CALIBRATED. Procedural geometry stays available otherwise.
            </DialogDescription>
          </DialogHeader>
          {modelAud && (
            <div className="space-y-4 pt-1">
              <div className="rounded-xl border border-white/10 p-4 space-y-2">
                {(modelAud.models || []).length === 0 && <p className="text-sm text-[#8FA3BF]">No model versions yet — the procedural demo geometry is in use.</p>}
                {(modelAud.models || []).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <StatusBadge status={m.status} />
                      <span className="font-medium">v{m.version}</span>
                      <span className="text-[#8FA3BF] text-xs">{m.kind === "UPLOADED" ? (m.fileUrl || "uploaded") : "Procedural demo geometry"}</span>
                    </span>
                    <Button size="sm" variant="outline" className="h-7 border-white/15 text-xs" onClick={() => publishModel(modelAud, m.id, m.kind)}>
                      Publish
                    </Button>
                  </div>
                ))}
              </div>

              <input
                ref={fileRef}
                type="file"
                accept=".glb,.gltf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f && modelAud) uploadModel(modelAud, f);
                  e.target.value = "";
                }}
              />
              <Button variant="outline" className="border-white/15" onClick={() => fileRef.current?.click()}>
                <Upload className="w-4 h-4 mr-2" /> Upload GLB/glTF model
              </Button>

              {(() => {
                const uploaded = (modelAud.models || []).filter((m) => m.kind === "UPLOADED");
                if (uploaded.length === 0) return null;
                const latest = uploaded[uploaded.length - 1];
                const rowLabels = JSON.parse(modelAud.layoutConfig as string).rows.map((r: { label: string }) => r.label) as string[];
                return (
                  <div className="rounded-xl border border-[#477BFF]/30 p-4 space-y-2.5">
                    <Label className="text-sm font-semibold">Row → model node prefix (v{latest.version})</Label>
                    <p className="text-xs text-[#8FA3BF]">Enter the name/prefix of the mesh group that contains each row&apos;s seats in your GLB (e.g. “RowA”). Publish is blocked until every row is mapped.</p>
                    <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto cine-scroll">
                      {rowLabels.map((label) => (
                        <div key={label} className="flex items-center gap-2">
                          <span className="w-12 text-xs font-bold text-[#20D9E8]">{label}</span>
                          <Input
                            value={nodeMap[label] || ""}
                            onChange={(e) => setNodeMap({ ...nodeMap, [label]: e.target.value })}
                            placeholder={`node prefix…`}
                            className="h-8 bg-[#0B0D12] text-xs"
                            aria-label={`Node prefix for row ${label}`}
                          />
                        </div>
                      ))}
                    </div>
                    <Button size="sm" className="bg-[#477BFF] hover:bg-[#5C89FF]" onClick={() => publishModel(modelAud, latest.id, "UPLOADED")}>
                      Save mapping &amp; publish v{latest.version}
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NumField({ label, value, onChange, step = 1, min, max }: { label: string; value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-[#8FA3BF]">{label}</Label>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (!isNaN(v)) onChange(Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v)));
        }}
        className="h-8 bg-[#0B0D12] text-sm"
      />
    </div>
  );
}
