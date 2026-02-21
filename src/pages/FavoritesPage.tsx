import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { EventCard } from "@/components/events/EventCard";
import { ArrowLeft, Heart } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function FavoritesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchFavorites();
  }, [user]);

  const fetchFavorites = async () => {
    if (!user) return;
    const { data: favs } = await supabase
      .from("favorite_events")
      .select("event_id")
      .eq("user_id", user.id);

    if (favs && favs.length > 0) {
      const ids = favs.map((f: any) => f.event_id);
      const { data } = await supabase
        .from("events")
        .select("*")
        .in("id", ids)
        .order("start_datetime", { ascending: true });
      setEvents(data || []);
    } else {
      setEvents([]);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background safe-top pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Избранное</h1>
      </div>

      <div className="px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Heart className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Избранных событий нет</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
