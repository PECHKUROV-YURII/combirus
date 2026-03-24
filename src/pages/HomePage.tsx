import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { EventCard } from "@/components/events/EventCard";
import { cn } from "@/lib/utils";

type Tab = "participating" | "organizing";

export default function HomePage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") === "organizing" ? "organizing" : "participating";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [participating, setParticipating] = useState<any[]>([]);
  const [organizing, setOrganizing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchData();
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Events I'm participating in
    const { data: myParticipations } = await supabase
      .from("event_participants")
      .select("event_id")
      .eq("user_id", user.id)
      .in("status", ["confirmed", "reserve"]);

    const participatingIds = myParticipations?.map((p: any) => p.event_id) || [];

    let participatingEvents: any[] = [];
    if (participatingIds.length > 0) {
      const { data } = await supabase
        .from("events")
        .select("*")
        .in("id", participatingIds)
        .in("status", ["published", "unpublished"])
        .order("start_datetime", { ascending: true });
      participatingEvents = data || [];
    }

    // Events I'm organizing — show ALL statuses
    const { data: organizingEvents } = await supabase
      .from("events")
      .select("*")
      .eq("organizer_user_id", user.id)
      .in("status", ["draft", "published", "unpublished"])
      .order("start_datetime", { ascending: true });

    // Fetch confirmed counts
    const allEvents = [...participatingEvents, ...(organizingEvents || [])];
    const allIds = allEvents.map((e: any) => e.id);
    let countMap: Record<string, number> = {};
    if (allIds.length > 0) {
      const { data: counts } = await supabase
        .from("event_participants")
        .select("event_id")
        .in("event_id", allIds)
        .eq("status", "confirmed");
      if (counts) {
        counts.forEach((c: any) => {
          countMap[c.event_id] = (countMap[c.event_id] || 0) + 1;
        });
      }
    }

    // For participating tab: show unpublished events as "cancelled" for display
    setParticipating(participatingEvents.map((e: any) => ({
      ...e,
      confirmed_count: countMap[e.id] || 0,
      displayStatus: e.status === "unpublished" ? "cancelled" : undefined,
    })));
    setOrganizing((organizingEvents || []).map((e: any) => ({ ...e, confirmed_count: countMap[e.id] || 0 })));

    // Auto-select tab with earliest event
    if (searchParams.get("tab") === "organizing") {
      setTab("organizing");
    } else if (participatingEvents.length === 0 && (organizingEvents?.length ?? 0) > 0) {
      setTab("organizing");
    } else if (participatingEvents.length > 0 && (organizingEvents?.length ?? 0) > 0) {
      const pFirst = new Date(participatingEvents[0].start_datetime);
      const oFirst = new Date(organizingEvents![0].start_datetime);
      setTab(pFirst <= oFirst ? "participating" : "organizing");
    }

    setLoading(false);
  };

  const currentEvents = tab === "participating" ? participating : organizing;

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <div className="min-h-screen bg-background safe-top">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 pt-4 pb-0">
        <h1 className="text-xl font-bold mb-3">
          <span className="text-primary">Combi</span>
        </h1>
        <div className="flex">
          <button
            onClick={() => setTab("participating")}
            className={cn(
              "flex-1 pb-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === "participating"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            )}
          >
            Я участвую
            {participating.length > 0 && tab !== "participating" && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {participating.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("organizing")}
            className={cn(
              "flex-1 pb-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === "organizing"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            )}
          >
            Я организую
            {organizing.length > 0 && tab !== "organizing" && (
              <span className="ml-1.5 text-xs bg-muted px-1.5 py-0.5 rounded-full">
                {organizing.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="px-4 py-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : currentEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center text-muted-foreground" style={{ minHeight: 'calc(60vh - 100px)' }}>
            <p className="text-lg font-medium">
              {tab === "participating" ? "Вы ещё не участвуете в событиях" : "Вы ещё не создали событий"}
            </p>
            <p className="text-sm mt-1">
              {tab === "participating" ? "Найдите интересные события в поиске" : "Нажмите + чтобы создать событие"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {currentEvents.map((event) => (
              <EventCard
                key={event.id}
                event={tab === "participating" && event.displayStatus ? { ...event, status: event.displayStatus } : event}
                showStatus={tab === "organizing" || (tab === "participating" && event.displayStatus === "cancelled")}
                onCopied={fetchData}
                onStatusChanged={fetchData}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}