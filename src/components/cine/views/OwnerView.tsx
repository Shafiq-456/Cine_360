"use client";
// Theatre Owner Console — tabbed shell (role-gated client side; APIs are the real gate).
import { useEffect } from "react";
import { navigate } from "@/lib/router";
import { useAuth } from "@/lib/store";
import { Spinner, EmptyState } from "./bits";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OwnerOverview from "./owner/OwnerOverview";
import OwnerTheatres from "./owner/OwnerTheatres";
import OwnerAuditoriums from "./owner/OwnerAuditoriums";
import OwnerShows from "./owner/OwnerShows";
import OwnerStaff from "./owner/OwnerStaff";
import { Building2 } from "lucide-react";

const TABS = ["overview", "theatres", "auditoriums", "shows", "bookings", "staff"] as const;
export type OwnerTab = (typeof TABS)[number];

export default function OwnerView({ params }: { params: URLSearchParams }) {
  const { session, sessionLoaded } = useAuth();
  // The URL is the single source of truth for the active tab (deep-linkable)
  const paramTab = params.get("tab");
  const tab: OwnerTab = TABS.includes(paramTab as OwnerTab) ? (paramTab as OwnerTab) : "overview";

  useEffect(() => {
    if (sessionLoaded && session && !["OWNER", "ADMIN"].includes(session.role)) {
      toast.error("The Owner Console is for theatre owner accounts.");
      navigate("/");
    }
     
  }, [session, sessionLoaded]);

  if (!sessionLoaded) return <div className="py-32 flex justify-center"><Spinner /></div>;
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return <EmptyState icon={<Building2 className="w-6 h-6" />} title="Owner access only" hint="Sign in with a theatre owner demo account from the sign-in page." />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Owner Console</h1>
        <p className="text-sm text-[#B4A6D4] mt-1">Run your venues: auditoriums, 3D models, showtimes, bookings and staff.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => { navigate(`/owner?tab=${v}`, { replace: true }); }}>
        <TabsList className="bg-[#1A1029] border border-white/10 h-auto flex-wrap">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="capitalize data-[state=active]:bg-[#8B5CF6] data-[state=active]:text-white px-4 py-2 cursor-pointer">
              {t}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="mt-6">
        {tab === "overview" && <OwnerOverview />}
        {tab === "theatres" && <OwnerTheatres />}
        {tab === "auditoriums" && <OwnerAuditoriums />}
        {(tab === "shows" || tab === "bookings") && <OwnerShows mode={tab} />}
        {tab === "staff" && <OwnerStaff />}
      </div>
    </div>
  );
}
