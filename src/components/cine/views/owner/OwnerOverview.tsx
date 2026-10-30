"use client";
// Owner overview: real metrics + 7-day revenue bars + occupancy table.
import { useEffect, useState } from "react";
import { api, inr, fmtDateTime } from "@/lib/client";
import { MetricCard, Spinner } from "../bits";
import { BarChart3 } from "lucide-react";

type Metrics = {
  theatres: number; auditoriums: number; totalBookings: number; todayBookings: number;
  cancelledBookings: number; revenue: number; netRevenue: number; commissionPercent: number;
  occupancyRate: number; todayShows: number; upcomingShows: number; seatsAvailable: number;
};
type Analytics = {
  byDay: { label: string; revenue: number; bookings: number }[];
  occupancyByShow: { id: string; startsAt: string; movie: string; auditorium: string; occupancy: number; revenue: number; booked: number; total: number }[];
  categoryMix: Record<string, { sold: number; revenue: number }>;
  commissionPercent: number;
};

export default function OwnerOverview() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  useEffect(() => {
    api.get<{ metrics: Metrics }>("/api/owner/overview").then((d) => setMetrics(d.metrics)).catch(() => setMetrics({} as Metrics));
    api.get<Analytics>("/api/owner/analytics").then(setAnalytics).catch(() => setAnalytics({ byDay: [], occupancyByShow: [], categoryMix: {}, commissionPercent: 0 }));
  }, []);

  if (!metrics) return <Spinner label="Computing metrics…" />;

  const maxRev = Math.max(1, ...(analytics?.byDay.map((d) => d.revenue) || [1]));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard label="Today's bookings" value={metrics.todayBookings} hint={`${metrics.todayShows} shows today`} />
        <MetricCard label="Revenue (paid)" value={inr(metrics.revenue)} hint={`Net after ${metrics.commissionPercent}% commission: ${inr(metrics.netRevenue)}`} accent="#2FBF71" />
        <MetricCard label="Occupancy today" value={`${metrics.occupancyRate}%`} hint={`${metrics.seatsAvailable} seats still free`} accent="#20D9E8" />
        <MetricCard label="Upcoming shows" value={metrics.upcomingShows} accent="#F5C518" />
        <MetricCard label="Total bookings" value={metrics.totalBookings} hint={`${metrics.cancelledBookings} cancelled/refunded`} />
        <MetricCard label="Venues" value={`${metrics.theatres} / ${metrics.auditoriums}`} hint="theatres / auditoriums" accent="#FF713D" />
      </div>

      <div className="cine-card p-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-[#477BFF]" /> Revenue — last 7 days (paid bookings)</h3>
        {analytics && analytics.byDay.length > 0 ? (
          <>
            <div className="flex items-end gap-3 h-40" role="img" aria-label="Bar chart of revenue over the last 7 days">
              {analytics.byDay.map((d) => (
                <div key={d.label} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end group">
                  <span className="text-[10px] text-[#8FA3BF] opacity-0 group-hover:opacity-100 transition-opacity">{d.revenue > 0 ? inr(d.revenue) : ""}</span>
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-[#477BFF]/40 to-[#477BFF] min-h-[2px] transition-all"
                    style={{ height: `${Math.max(2, (d.revenue / maxRev) * 100)}%` }}
                  />
                  <span className="text-[10px] text-[#8FA3BF] whitespace-nowrap">{d.label.split(" ")[0]} {d.label.split(" ")[1]}</span>
                </div>
              ))}
            </div>
            <p className="text-[11px] text-[#8FA3BF] mt-3">Bookings per day: {analytics.byDay.map((d) => `${d.bookings}`).join(" · ")} (same order)</p>
          </>
        ) : (
          <p className="text-sm text-[#8FA3BF]">No paid bookings in the last 7 days yet.</p>
        )}
      </div>

      <div className="cine-card p-6">
        <h3 className="font-semibold mb-4">Occupancy by show</h3>
        {analytics && analytics.occupancyByShow.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[#8FA3BF] uppercase tracking-wider">
                  <th className="py-2 pr-4 font-medium">Show</th>
                  <th className="py-2 pr-4 font-medium">Movie</th>
                  <th className="py-2 pr-4 font-medium">Auditorium</th>
                  <th className="py-2 pr-4 font-medium">Occupancy</th>
                  <th className="py-2 pr-4 font-medium">Booked</th>
                  <th className="py-2 font-medium">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analytics.occupancyByShow.slice(0, 12).map((s) => (
                  <tr key={s.id} className="border-t border-white/5">
                    <td className="py-2.5 pr-4 whitespace-nowrap">{fmtDateTime(s.startsAt)}</td>
                    <td className="py-2.5 pr-4">{s.movie}</td>
                    <td className="py-2.5 pr-4 text-[#8FA3BF]">{s.auditorium}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${s.occupancy}%`, background: s.occupancy >= 80 ? "#2FBF71" : s.occupancy >= 40 ? "#F5C518" : "#FF713D" }} />
                        </div>
                        <span className="text-xs">{s.occupancy}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4 text-xs text-[#8FA3BF]">{s.booked}/{s.total}</td>
                    <td className="py-2.5">{inr(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#8FA3BF]">Schedule shows to see occupancy analytics.</p>
        )}
      </div>

      <p className="text-[11px] text-[#8FA3BF]">
        All metrics are computed live from application data (bookings, payments, show inventory) — no fabricated statistics.
      </p>
    </div>
  );
}
