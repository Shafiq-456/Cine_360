"use client";
// Small shared building blocks for CINE 360 views.
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 text-[#B4A6D4] ${className}`} role="status" aria-live="polite">
      <Loader2 className="w-6 h-6 animate-spin text-[#8B5CF6]" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8 cine-rise">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        <div className="mt-2.5 h-[3px] w-24 rounded-full bg-gradient-to-r from-[#8B5CF6] via-[#F2B04C] to-[#F0659A] bg-[length:200%_100%] [animation:cine-gradient-shift_6s_ease-in-out_infinite_alternate]" aria-hidden="true" />
        {subtitle && <p className="text-[#B4A6D4] mt-3 max-w-2xl">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-6 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-[#1F1330] border border-white/5 flex items-center justify-center text-[#8B5CF6]">
        {icon || "🎬"}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {hint && <p className="text-[#B4A6D4] max-w-sm">{hint}</p>}
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: "bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30",
    PENDING: "bg-[#FFD166]/15 text-[#FFD166] border-[#FFD166]/30",
    SUSPENDED: "bg-[#F0659A]/15 text-[#F0659A] border-[#F0659A]/30",
    REJECTED: "bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/30",
    CONFIRMED: "bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30",
    PAID: "bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30",
    PENDING_PAYMENT: "bg-[#FFD166]/15 text-[#FFD166] border-[#FFD166]/30",
    CANCELLED: "bg-white/10 text-[#B4A6D4] border-white/15",
    REFUNDED: "bg-[#F0659A]/15 text-[#F0659A] border-[#F0659A]/30",
    VALID: "bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30",
    REDEEMED: "bg-[#8B5CF6]/15 text-[#C4B5FD] border-[#8B5CF6]/30",
    VOID: "bg-white/10 text-[#B4A6D4] border-white/15",
    SCHEDULED: "bg-[#8B5CF6]/15 text-[#C4B5FD] border-[#8B5CF6]/30",
    COMPLETED: "bg-white/10 text-[#B4A6D4] border-white/15",
    FAILED: "bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/30",
    CREATED: "bg-[#FFD166]/15 text-[#FFD166] border-[#FFD166]/30",
    ACTIVE: "bg-[#34D399]/15 text-[#34D399] border-[#34D399]/30",
    INACTIVE: "bg-white/10 text-[#B4A6D4] border-white/15",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[status] || "bg-white/10 text-[#B4A6D4] border-white/15"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function MetricCard({ label, value, hint, accent = "#8B5CF6" }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="cine-card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="text-xs uppercase tracking-wider text-[#B4A6D4]">{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-1.5" style={{ color: accent === "#8B5CF6" ? "#F7F2FE" : accent }}>{value}</div>
      {hint && <div className="text-xs text-[#B4A6D4] mt-1">{hint}</div>}
    </div>
  );
}
