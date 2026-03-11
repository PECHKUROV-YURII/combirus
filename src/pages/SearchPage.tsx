import { useState, useEffect } from "react";
import { Search, CalendarIcon, X } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EventCard } from "@/components/events/EventCard";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateFilter = "today" | "tomorrow" | "custom" | null;

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>(null);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [paidFilter, setPaidFilter] = useState<boolean | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, [query, dateFilter, customDate, categoryFilter, paidFilter]);

  const fetchEvents = async () => {
    setLoading(true);
    let q = supabase
      .from("events")
      .select("*")
      .eq("status", "active")
      .eq("is_private", false)
      .order("start_datetime", { ascending: true });

    if (query) {
      q = q.ilike("title", `%${query}%`);
    }

    const now = new Date();
    if (dateFilter === "today") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      q = q.gte("start_datetime", start).lt("start_datetime", end);
    } else if (dateFilter === "tomorrow") {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2).toISOString();
      q = q.gte("start_datetime", start).lt("start_datetime", end);
    } else if (dateFilter === "custom" && customDate) {
      const start = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate()).toISOString();
      const end = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate() + 1).toISOString();
      q = q.gte("start_datetime", start).lt("start_datetime", end);
    }
    // dateFilter === null → no date filter, show all sorted by date

    if (categoryFilter) {
      q = q.eq("category", categoryFilter);
    }

    if (paidFilter !== null) {
      q = q.eq("is_paid", paidFilter);
    }

    const { data } = await q.limit(50);

    // Fetch participant counts
    if (data && data.length > 0) {
      const eventIds = data.map((e: any) => e.id);
      const { data: participants } = await supabase
        .from("event_participants")
        .select("event_id, status")
        .in("event_id", eventIds)
        .eq("status", "confirmed");

      const countMap: Record<string, number> = {};
      participants?.forEach((p: any) => {
        countMap[p.event_id] = (countMap[p.event_id] || 0) + 1;
      });

      setEvents(
        data.map((e: any) => ({ ...e, confirmed_count: countMap[e.id] || 0 }))
      );
    } else {
      setEvents([]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background safe-top">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 pt-4 pb-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск событий..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {/* Date filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(["today", "tomorrow", "all"] as DateFilter[]).map((d) => (
            <Badge
              key={d}
              variant={dateFilter === d ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap shrink-0"
              onClick={() => setDateFilter(d)}
            >
              {d === "today" ? "Сегодня" : d === "tomorrow" ? "Завтра" : "Все даты"}
            </Badge>
          ))}
        </div>

        {/* Paid filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {paidFilter === null ? (
            <>
              <Badge
                variant="outline"
                className="cursor-pointer whitespace-nowrap shrink-0"
                onClick={() => setPaidFilter(false)}
              >
                Бесплатно
              </Badge>
              <Badge
                variant="outline"
                className="cursor-pointer whitespace-nowrap shrink-0"
                onClick={() => setPaidFilter(true)}
              >
                Платно
              </Badge>
            </>
          ) : (
            <Badge
              variant="default"
              className="cursor-pointer whitespace-nowrap shrink-0"
              onClick={() => setPaidFilter(null)}
            >
              {paidFilter ? "Платно ✕" : "Бесплатно ✕"}
            </Badge>
          )}
        </div>

        {/* Category filters */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <Badge
            variant={categoryFilter === null ? "default" : "outline"}
            className="cursor-pointer whitespace-nowrap shrink-0"
            onClick={() => setCategoryFilter(null)}
          >
            Все
          </Badge>
          {EVENT_CATEGORIES.map((cat) => (
            <Badge
              key={cat.value}
              variant={categoryFilter === cat.value ? "default" : "outline"}
              className="cursor-pointer whitespace-nowrap shrink-0"
              onClick={() =>
                setCategoryFilter(categoryFilter === cat.value ? null : cat.value)
              }
            >
              {cat.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Событий не найдено</p>
            <p className="text-sm mt-1">Попробуйте другие фильтры</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
