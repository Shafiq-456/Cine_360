"use client";
// Small shared building blocks for CINE 360 views (Obsidian Amber theme).
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 text-[#94A3B8] ${className}`} role="status" aria-live="polite">
      <Loader2 className="w-6 h-6 animate-spin text-[#F59E0B]" />
      {label && <span className="text-sm font-medium">{label}</span>}
    </div>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8 cine-rise">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        <div className="mt-2.5 h-[3px] w-24 rounded-full bg-gradient-to-r from-[#F59E0B] via-[#FBBF24] to-[#38BDF8] bg-[length:200%_100%] [animation:cine-gradient-shift_6s_ease-in-out_infinite_alternate]" aria-hidden="true" />
        {subtitle && <p className="text-[#94A3B8] mt-3 max-w-2xl">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-6 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-[#141722] border border-white/5 flex items-center justify-center text-[#F59E0B]">
        {icon || "🎬"}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {hint && <p className="text-[#94A3B8] max-w-sm">{hint}</p>}
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
    PENDING: "bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30",
    SUSPENDED: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
    REJECTED: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
    CONFIRMED: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
    PAID: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
    PENDING_PAYMENT: "bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30",
    CANCELLED: "bg-white/10 text-[#94A3B8] border-white/15",
    REFUNDED: "bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30",
    VALID: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
    REDEEMED: "bg-[#F59E0B]/15 text-[#FBBF24] border-[#F59E0B]/30",
    VOID: "bg-white/10 text-[#94A3B8] border-white/15",
    SCHEDULED: "bg-[#38BDF8]/15 text-[#38BDF8] border-[#38BDF8]/30",
    COMPLETED: "bg-white/10 text-[#94A3B8] border-white/15",
    FAILED: "bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/30",
    CREATED: "bg-[#FBBF24]/15 text-[#FBBF24] border-[#FBBF24]/30",
    ACTIVE: "bg-[#10B981]/15 text-[#10B981] border-[#10B981]/30",
    INACTIVE: "bg-white/10 text-[#94A3B8] border-white/15",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[status] || "bg-white/10 text-[#94A3B8] border-white/15"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function MetricCard({ label, value, hint, accent = "#F59E0B" }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="cine-card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="text-xs uppercase tracking-wider text-[#94A3B8]">{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-1.5" style={{ color: accent === "#F59E0B" ? "#F8FAFC" : accent }}>{value}</div>
      {hint && <div className="text-xs text-[#94A3B8] mt-1">{hint}</div>}
    </div>
  );
}
