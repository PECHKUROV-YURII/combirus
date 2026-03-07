import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowLeft, Calendar, MapPin, Users, Heart, Share2, MessageCircle, Edit, XCircle,
  Copy, ExternalLink, Link as LinkIcon, X,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getCategoryLabel, getLevelLabel } from "@/lib/categories";

export default function EventDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [organizer, setOrganizer] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [myStatus, setMyStatus] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAllParticipants, setShowAllParticipants] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  const MAX_VISIBLE_AVATARS = 6;

  useEffect(() => {
    fetchEvent();
  }, [id]);

  const fetchEvent = async () => {
    if (!id) return;
    setLoading(true);

    const { data: eventData } = await supabase
      .from("events")
      .select("*")
      .eq("id", id)
      .single();

    if (!eventData) {
      navigate("/search");
      return;
    }

    setEvent(eventData);

    // Fetch organizer profile
    const { data: orgProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", eventData.organizer_user_id)
      .single();
    setOrganizer(orgProfile);

    // Fetch participants
    const { data: parts } = await supabase
      .from("event_participants")
      .select("*")
      .eq("event_id", id)
      .in("status", ["confirmed", "reserve"]);

    // We need to get profiles separately since we can't join on user_id directly
    const partsList = parts || [];
    const userIds = partsList.map((p: any) => p.user_id);
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .in("user_id", userIds);
      profiles?.forEach((p: any) => {
        profilesMap[p.user_id] = p;
      });
    }

    setParticipants(
      partsList.map((p: any) => ({
        ...p,
        profile: profilesMap[p.user_id] || { name: "Участник", avatar_url: null },
      }))
    );

    // Check my status
    if (user) {
      const myPart = partsList.find((p: any) => p.user_id === user.id);
      setMyStatus(myPart?.status || null);

      const { data: fav } = await supabase
        .from("favorite_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("event_id", id)
        .maybeSingle();
      setIsFavorite(!!fav);
    }

    setLoading(false);
  };

  const handleJoin = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!event) return;

    const confirmedCount = participants.filter((p) => p.status === "confirmed").length;
    const reserveCount = participants.filter((p) => p.status === "reserve").length;

    let status: string;
    if (confirmedCount < event.max_participants) {
      status = "confirmed";
    } else if (reserveCount < event.reserve_limit) {
      status = "reserve";
    } else {
      toast.error("Мест нет");
      return;
    }

    const { error } = await supabase.from("event_participants").insert({
      event_id: event.id,
      user_id: user.id,
      status,
    });

    if (error) {
      toast.error("Ошибка записи");
    } else {
      toast.success(status === "confirmed" ? "Вы записаны!" : "Вы в резерве");
      fetchEvent();
    }
  };

  const handleCancel = async () => {
    if (!user || !event) return;
    const { error } = await supabase
      .from("event_participants")
      .update({ status: "cancelled" })
      .eq("event_id", event.id)
      .eq("user_id", user.id);

    if (error) {
      toast.error("Ошибка отмены");
    } else {
      toast.success("Запись отменена");
      fetchEvent();
    }
  };

  const toggleFavorite = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (isFavorite) {
      await supabase
        .from("favorite_events")
        .delete()
        .eq("user_id", user.id)
        .eq("event_id", event.id);
      setIsFavorite(false);
    } else {
      await supabase.from("favorite_events").insert({
        user_id: user.id,
        event_id: event.id,
      });
      setIsFavorite(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!event) return null;

  const confirmedList = participants.filter((p) => p.status === "confirmed");
  const reserveList = participants.filter((p) => p.status === "reserve");
  const isOrganizer = user?.id === event.organizer_user_id;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header image */}
      <div className="relative aspect-[16/9] bg-muted">
        {event.cover_images?.[0] ? (
          <img src={event.cover_images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Calendar className="w-16 h-16" />
          </div>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="absolute top-4 right-4 flex gap-2">
          <button
            onClick={toggleFavorite}
            className="w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center"
          >
            <Heart className={`w-5 h-5 ${isFavorite ? "fill-primary text-primary" : ""}`} />
          </button>
          <button className="w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Private invite link */}
      {event.is_private && event.private_invite_link && (
        <div className="mx-4 mt-4 p-3 rounded-xl border bg-card space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <LinkIcon className="w-4 h-4 text-primary" />
            Ссылка на событие
          </div>
          <p className="text-xs text-muted-foreground">
            Поделитесь ссылкой с теми, кого хотите пригласить
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 text-xs bg-muted rounded-lg px-3 py-2 truncate select-all">
              {`https://combirus.lovable.app/event/${event.id}`}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(`https://combirus.lovable.app/event/${event.id}`);
                toast.success("Ссылка скопирована");
              }}
              className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                const url = `https://combirus.lovable.app/event/${event.id}`;
                const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(event.title)}`;
                window.open(tgUrl, "_blank");
              }}
              className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center hover:bg-accent transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {/* Role badge */}
        {user && (
          <div>
            {isOrganizer ? (
              <Badge className="bg-primary/10 text-primary border-primary/20">Вы организатор</Badge>
            ) : myStatus === "confirmed" ? (
              <Badge className="bg-accent text-accent-foreground border">Вы участник</Badge>
            ) : myStatus === "reserve" ? (
              <Badge className="bg-muted text-muted-foreground border">Вы в резерве</Badge>
            ) : null}
          </div>
        )}

        {/* Title and badges */}
        <div>
          <h1 className="text-xl font-bold">{event.title}</h1>
          <div className="flex gap-2 mt-2">
            <Badge variant="secondary">{getCategoryLabel(event.category)}</Badge>
            {event.level !== "any" && (
              <Badge variant="outline">{getLevelLabel(event.level)}</Badge>
            )}
            {event.is_paid ? (
              <Badge className="bg-primary text-primary-foreground">{event.price} ₽</Badge>
            ) : (
              <Badge variant="outline">Бесплатно</Badge>
            )}
          </div>
        </div>

        {/* Date & location */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-primary" />
            <span>
              {format(new Date(event.start_datetime), "d MMMM yyyy, HH:mm", { locale: ru })}
              {event.end_datetime &&
                ` — ${format(new Date(event.end_datetime), "HH:mm", { locale: ru })}`}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-primary" />
            <span>{event.address_text}</span>
          </div>
        </div>

        {/* Organizer */}
        {organizer && (
          <button
            onClick={() => navigate(`/user/${organizer.user_id}`)}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 w-full text-left"
          >
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
              {organizer.name?.[0]?.toUpperCase() || "?"}
            </div>
            <div>
              <p className="text-sm font-medium">{organizer.name || "Организатор"}</p>
              <p className="text-xs text-muted-foreground">Организатор</p>
            </div>
          </button>
        )}

        {/* Description */}
        {event.description && (
          <div>
            <h2 className="font-semibold text-sm mb-1">Описание</h2>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.description}</p>
          </div>
        )}

        {/* Participants */}
        <div>
          <h2 className="font-semibold text-sm mb-2">
            Участники ({confirmedList.length}/{event.max_participants})
          </h2>
          <div className="flex flex-wrap gap-2">
            {confirmedList.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1"
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] text-primary font-semibold">
                  {p.profile?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <span className="text-xs">{p.profile?.name || "Участник"}</span>
              </div>
            ))}
          </div>
          {reserveList.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-1">
                Резерв ({reserveList.length}/{event.reserve_limit})
              </p>
              <div className="flex flex-wrap gap-2">
                {reserveList.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-1.5 bg-muted rounded-full px-2.5 py-1"
                  >
                    <span className="text-xs">{p.profile?.name || "Участник"}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom actions */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t">
        <div className="flex gap-2 max-w-lg mx-auto">
          {isOrganizer ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/event/${event.id}/chat`)}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Чат
              </Button>
              <Button
                className="flex-1"
                onClick={() => navigate(`/create?edit=${event.id}`)}
              >
                <Edit className="w-4 h-4 mr-1" />
                Редактировать
              </Button>
            </>
          ) : myStatus === "confirmed" || myStatus === "reserve" ? (
            <>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => navigate(`/event/${event.id}/chat`)}
              >
                <MessageCircle className="w-4 h-4 mr-1" />
                Чат
              </Button>
              <Button variant="destructive" className="flex-1" onClick={handleCancel}>
                <XCircle className="w-4 h-4 mr-1" />
                Отменить запись
              </Button>
            </>
          ) : (
            <Button className="flex-1" onClick={handleJoin}>
              Записаться
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
