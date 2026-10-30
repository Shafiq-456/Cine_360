"use client";
// Small shared building blocks for CINE 360 views.
import { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function Spinner({ label, className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`flex flex-col items-center gap-3 text-[#8FA3BF] ${className}`} role="status" aria-live="polite">
      <Loader2 className="w-6 h-6 animate-spin text-[#477BFF]" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-[#8FA3BF] mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint, action }: { icon?: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-20 px-6 gap-3">
      <div className="w-14 h-14 rounded-2xl bg-[#171A21] border border-white/5 flex items-center justify-center text-[#477BFF]">
        {icon || "🎬"}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {hint && <p className="text-[#8FA3BF] max-w-sm">{hint}</p>}
      {action}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: "bg-[#2FBF71]/15 text-[#2FBF71] border-[#2FBF71]/30",
    PENDING: "bg-[#F5C518]/15 text-[#F5C518] border-[#F5C518]/30",
    SUSPENDED: "bg-[#FF713D]/15 text-[#FF713D] border-[#FF713D]/30",
    REJECTED: "bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/30",
    CONFIRMED: "bg-[#2FBF71]/15 text-[#2FBF71] border-[#2FBF71]/30",
    PAID: "bg-[#2FBF71]/15 text-[#2FBF71] border-[#2FBF71]/30",
    PENDING_PAYMENT: "bg-[#F5C518]/15 text-[#F5C518] border-[#F5C518]/30",
    CANCELLED: "bg-white/10 text-[#8FA3BF] border-white/15",
    REFUNDED: "bg-[#FF713D]/15 text-[#FF713D] border-[#FF713D]/30",
    VALID: "bg-[#2FBF71]/15 text-[#2FBF71] border-[#2FBF71]/30",
    REDEEMED: "bg-[#477BFF]/15 text-[#9FC0FF] border-[#477BFF]/30",
    VOID: "bg-white/10 text-[#8FA3BF] border-white/15",
    SCHEDULED: "bg-[#477BFF]/15 text-[#9FC0FF] border-[#477BFF]/30",
    COMPLETED: "bg-white/10 text-[#8FA3BF] border-white/15",
    FAILED: "bg-[#E5484D]/15 text-[#E5484D] border-[#E5484D]/30",
    CREATED: "bg-[#F5C518]/15 text-[#F5C518] border-[#F5C518]/30",
    ACTIVE: "bg-[#2FBF71]/15 text-[#2FBF71] border-[#2FBF71]/30",
    INACTIVE: "bg-white/10 text-[#8FA3BF] border-white/15",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[status] || "bg-white/10 text-[#8FA3BF] border-white/15"}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function MetricCard({ label, value, hint, accent = "#477BFF" }: { label: string; value: string | number; hint?: string; accent?: string }) {
  return (
    <div className="cine-card p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      <div className="text-xs uppercase tracking-wider text-[#8FA3BF]">{label}</div>
      <div className="text-2xl md:text-3xl font-bold mt-1.5" style={{ color: accent === "#477BFF" ? "#F5F7FA" : accent }}>{value}</div>
      {hint && <div className="text-xs text-[#8FA3BF] mt-1">{hint}</div>}
    </div>
  );
}
