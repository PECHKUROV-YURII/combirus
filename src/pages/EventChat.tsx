import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

export default function EventChat() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [profiles, setProfiles] = useState<Record<string, any>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id || !user) return;
    fetchMessages();
    fetchEventTitle();

    const channel = supabase
      .channel(`event-chat-${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "event_chat_messages", filter: `event_id=eq.${id}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new]);
          fetchProfileFor(payload.new.sender_user_id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchEventTitle = async () => {
    const { data } = await supabase.from("events").select("title").eq("id", id!).single();
    if (data) setEventTitle(data.title);
  };

  const fetchProfileFor = async (userId: string) => {
    if (profiles[userId]) return;
    const { data } = await supabase.from("profiles").select("user_id, name, avatar_url").eq("user_id", userId).single();
    if (data) setProfiles((prev) => ({ ...prev, [userId]: data }));
  };

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("event_chat_messages")
      .select("*")
      .eq("event_id", id!)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(data);
      const userIds = [...new Set(data.map((m: any) => m.sender_user_id))];
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, name, avatar_url")
          .in("user_id", userIds);
        const map: Record<string, any> = {};
        profs?.forEach((p: any) => { map[p.user_id] = p; });
        setProfiles(map);
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !user) return;
    await supabase.from("event_chat_messages").insert({
      event_id: id!,
      sender_user_id: user.id,
      message_text: newMessage.trim(),
    });
    setNewMessage("");
  };

  const isSystemMessage = (msg: any) => msg.sender_user_id === "00000000-0000-0000-0000-000000000000";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold truncate">{eventTitle || "Чат события"}</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <MessageCircle className="w-10 h-10 mb-2 opacity-50" />
            <p className="text-sm">Сообщений пока нет</p>
          </div>
        ) : (
          messages.map((msg) => {
            if (isSystemMessage(msg)) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-muted/60 rounded-xl px-4 py-2 text-xs text-muted-foreground text-center max-w-[85%]">
                    {msg.message_text}
                  </div>
                </div>
              );
            }

            const isMe = msg.sender_user_id === user?.id;
            const senderName = profiles[msg.sender_user_id]?.name || "Участник";
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {!isMe && (
                    <p className="text-xs font-medium mb-0.5 opacity-70">{senderName}</p>
                  )}
                  <p className="text-sm">{msg.message_text}</p>
                  <p className={`text-[10px] mt-0.5 ${isMe ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {format(new Date(msg.created_at), "HH:mm")}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 safe-bottom">
        <div className="flex gap-2">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Сообщение..."
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            className="flex-1"
          />
          <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
