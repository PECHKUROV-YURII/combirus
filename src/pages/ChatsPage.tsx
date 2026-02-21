import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = "events" | "direct";

export default function ChatsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("events");
  const [eventChats, setEventChats] = useState<any[]>([]);
  const [directChats, setDirectChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchChats();
  }, [user]);

  const fetchChats = async () => {
    if (!user) return;
    setLoading(true);

    // Event chats - events I'm in
    const { data: myParts } = await supabase
      .from("event_participants")
      .select("event_id")
      .eq("user_id", user.id)
      .in("status", ["confirmed", "reserve"]);

    const { data: myOrg } = await supabase
      .from("events")
      .select("id")
      .eq("organizer_user_id", user.id)
      .eq("status", "active");

    const eventIds = [
      ...(myParts?.map((p: any) => p.event_id) || []),
      ...(myOrg?.map((e: any) => e.id) || []),
    ];

    const uniqueIds = [...new Set(eventIds)];
    if (uniqueIds.length > 0) {
      const { data: events } = await supabase
        .from("events")
        .select("id, title, start_datetime")
        .in("id", uniqueIds)
        .eq("status", "active")
        .order("start_datetime", { ascending: true });
      setEventChats(events || []);
    }

    // Direct chats
    const { data: dChats } = await supabase
      .from("direct_chats")
      .select("*")
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (dChats && dChats.length > 0) {
      const otherIds = dChats.map((c: any) =>
        c.user1_id === user.id ? c.user2_id : c.user1_id
      );
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", otherIds);

      const profileMap: Record<string, any> = {};
      profiles?.forEach((p: any) => {
        profileMap[p.user_id] = p;
      });

      setDirectChats(
        dChats.map((c: any) => {
          const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
          return { ...c, otherProfile: profileMap[otherId] || { name: "Пользователь" } };
        })
      );
    }

    setLoading(false);
  };

  if (!user) {
    navigate("/auth");
    return null;
  }

  return (
    <div className="min-h-screen bg-background safe-top">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 pt-4 pb-0">
        <h1 className="text-xl font-bold mb-3">Чаты</h1>
        <div className="flex">
          <button
            onClick={() => setTab("events")}
            className={cn(
              "flex-1 pb-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === "events" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >
            События
          </button>
          <button
            onClick={() => setTab("direct")}
            className={cn(
              "flex-1 pb-2.5 text-sm font-medium border-b-2 transition-colors",
              tab === "direct" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
            )}
          >
            Личные
          </button>
        </div>
      </div>

      <div className="px-4 py-2">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : tab === "events" ? (
          eventChats.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
              <p>Нет чатов событий</p>
            </div>
          ) : (
            <div className="space-y-1">
              {eventChats.map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => navigate(`/event/${chat.id}/chat`)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{chat.title}</p>
                    <p className="text-xs text-muted-foreground">Чат события</p>
                  </div>
                </button>
              ))}
            </div>
          )
        ) : directChats.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>Нет личных сообщений</p>
          </div>
        ) : (
          <div className="space-y-1">
            {directChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => navigate(`/chat/${chat.id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                  {chat.otherProfile?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{chat.otherProfile?.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
