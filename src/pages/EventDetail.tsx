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
  Calendar, MapPin, Users, Heart, Share2, MessageCircle, Edit, XCircle,
  Copy, ExternalLink, Link as LinkIcon, X, Trash2, Send,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getCategoryLabel, getLevelLabel } from "@/lib/categories";
import { TabBar } from "@/components/layout/TabBar";

const statusLabels: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-muted text-muted-foreground" },
  published: { label: "Опубликовано", className: "bg-primary/10 text-primary border-primary/20" },
  unpublished: { label: "Снято с публикации", className: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Отменено", className: "bg-destructive/10 text-destructive border-destructive/20" },
  completed: { label: "Завершено", className: "bg-green-500/10 text-green-700 border-green-500/20" },
};

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
  const [publishDialog, setPublishDialog] = useState(false);
  const [unpublishDialog, setUnpublishDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState(false);

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

    const { data: orgProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", eventData.organizer_user_id)
      .single();
    setOrganizer(orgProfile);

    const { data: parts } = await supabase
      .from("event_participants")
      .select("*")
      .eq("event_id", id)
      .in("status", ["confirmed", "reserve"]);

    const partsList = parts || [];
    const userIds = partsList.map((p: any) => p.user_id);
    let profilesMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, bio")
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

  const getReserveLimit = (maxParticipants: number, storedLimit?: number | null) => {
    if (typeof storedLimit === "number" && storedLimit > 0) return storedLimit;
    return Math.ceil(maxParticipants * 0.3);
  };

  const handleJoin = async (forceReserve = false) => {
    if (!user) { navigate("/auth"); return; }
    if (!event) return;

    const confirmedCount = participants.filter((p) => p.status === "confirmed").length;
    const reserveCount = participants.filter((p) => p.status === "reserve").length;
    const reserveLimit = getReserveLimit(event.max_participants, event.reserve_limit);

    let status: string;
    if (!forceReserve && confirmedCount < event.max_participants) {
      status = "confirmed";
    } else if (reserveCount < reserveLimit) {
      status = "reserve";
    } else {
      toast.error("Мест нет, резерв заполнен");
      return;
    }

    const { data: existingParticipation, error: existingParticipationError } = await supabase
      .from("event_participants")
      .select("id, status")
      .eq("event_id", event.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingParticipationError) {
      toast.error("Ошибка записи");
      return;
    }

    const request = existingParticipation
      ? supabase
          .from("event_participants")
          .update({ status, joined_at: new Date().toISOString() })
          .eq("id", existingParticipation.id)
      : supabase.from("event_participants").insert({
          event_id: event.id,
          user_id: user.id,
          status,
        });

    const { error } = await request;

    if (error) { toast.error("Ошибка записи"); }
    else { toast.success(status === "confirmed" ? "Вы записаны!" : "Вы в резервном списке"); fetchEvent(); }
  };

  const handleCancel = async () => {
    if (!user || !event) return;
    const wasPreviouslyConfirmed = myStatus === "confirmed";

    if (wasPreviouslyConfirmed) {
      const { error: chatError } = await supabase.from("event_chat_messages").insert({
        event_id: event.id,
        sender_user_id: user.id,
        message_text: "⚡ Освободилось место! Запишитесь, пока оно свободно.",
      });

      if (chatError) {
        console.error("Chat notification error:", chatError);
      }
    }

    const { error } = await supabase
      .from("event_participants")
      .update({ status: "cancelled" })
      .eq("event_id", event.id)
      .eq("user_id", user.id);

    if (error) { toast.error("Ошибка отмены"); return; }

    toast.success("Запись отменена");
    fetchEvent();
  };

  const toggleFavorite = async () => {
    if (!user) { navigate("/auth"); return; }
    if (isFavorite) {
      await supabase.from("favorite_events").delete().eq("user_id", user.id).eq("event_id", event.id);
      setIsFavorite(false);
    } else {
      await supabase.from("favorite_events").insert({ user_id: user.id, event_id: event.id });
      setIsFavorite(true);
    }
  };

  const handlePublish = async () => {
    const { error } = await supabase.from("events").update({ status: "published" }).eq("id", event.id);
    if (error) { toast.error("Ошибка публикации"); }
    else { toast.success("Событие опубликовано!"); setEvent({ ...event, status: "published" }); }
    setPublishDialog(false);
  };

  const handleUnpublish = async () => {
    const { error } = await supabase.from("events").update({ status: "unpublished" }).eq("id", event.id);
    if (error) { toast.error("Ошибка"); }
    else { toast.success("Событие снято с публикации"); setEvent({ ...event, status: "unpublished" }); }
    setUnpublishDialog(false);
  };

  const handleDelete = async () => {
    const { error } = await supabase.from("events").delete().eq("id", event.id);
    if (error) { toast.error("Ошибка удаления"); }
    else { toast.success("Событие удалено"); navigate("/home?tab=organizing"); }
    setDeleteDialog(false);
  };

  const handleShare = async () => {
    const url = `https://combirus.lovable.app/event/${event.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: event.title, url }); } catch {}
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
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
  const isParticipant = myStatus === "confirmed" || myStatus === "reserve";
  // Organizer sees actual status; participants see "Отменено" for unpublished events
  const displayStatus = !isOrganizer && isParticipant && event.status === "unpublished" ? "cancelled" : event.status;
  const statusInfo = statusLabels[displayStatus];

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header image */}
      <div className="relative aspect-[16/9] bg-muted">
        {event.cover_images?.[0] ? (
          <img src={event.cover_images[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <Calendar className="w-16 h-16" />
          </div>
        )}
        <div className="absolute top-4 left-4 flex gap-2">
          <button
            onClick={toggleFavorite}
            className="w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center"
          >
            <Heart className={`w-5 h-5 ${isFavorite ? "fill-primary text-primary" : ""}`} />
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center">
                <Share2 className="w-5 h-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-1" align="start">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`https://combirus.lovable.app/event/${event.id}`);
                  toast.success("Ссылка скопирована");
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                <Copy className="w-4 h-4" />
                Скопировать ссылку
              </button>
              <button
                onClick={() => {
                  const url = `https://combirus.lovable.app/event/${event.id}`;
                  window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(event.title)}`, "_blank");
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                <Send className="w-4 h-4" />
                Telegram
              </button>
              <button
                onClick={() => {
                  const url = `https://combirus.lovable.app/event/${event.id}`;
                  window.open(`https://wa.me/?text=${encodeURIComponent(event.title + " " + url)}`, "_blank");
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </button>
            </PopoverContent>
          </Popover>
        </div>
        <button
          onClick={() => navigate("/home?tab=organizing")}
          className="absolute top-4 right-4 w-9 h-9 rounded-full bg-card/80 backdrop-blur-sm flex items-center justify-center"
        >
          <X className="w-5 h-5" />
        </button>
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

        {/* Title, status, and organizer actions */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-bold">{event.title}</h1>
              {isOrganizer && statusInfo && (
                <Badge className={`mt-1 ${statusInfo.className}`}>{statusInfo.label}</Badge>
              )}
              {!isOrganizer && isParticipant && event.status === "unpublished" && (
                <Badge className={`mt-1 ${statusLabels.cancelled.className}`}>{statusLabels.cancelled.label}</Badge>
              )}
            </div>
          </div>


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
          <h2 className="font-semibold text-sm mb-1">
            Участники ({confirmedList.length}/{event.max_participants})
          </h2>
          {isOrganizer && (event as any).min_participants > 1 && (
            <p className="text-xs text-muted-foreground mb-3">
              Мин. для проведения: {(event as any).min_participants}
            </p>
          )}
          <div className="flex items-center">
            {confirmedList.slice(0, MAX_VISIBLE_AVATARS).map((p, i) => (
              <button
                key={p.id}
                onClick={() => setSelectedProfile(p.profile)}
                className="relative rounded-full border-2 border-background hover:z-20 transition-transform hover:scale-110"
                style={{ marginLeft: i === 0 ? 0 : -10, zIndex: MAX_VISIBLE_AVATARS - i }}
              >
                <Avatar className="w-10 h-10">
                  {p.profile?.avatar_url ? (
                    <AvatarImage src={p.profile.avatar_url} alt={p.profile?.name} />
                  ) : null}
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {p.profile?.name?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
            ))}
            {confirmedList.length > MAX_VISIBLE_AVATARS && (
              <button
                onClick={() => setShowAllParticipants(true)}
                className="relative w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
                style={{ marginLeft: -10, zIndex: 0 }}
              >
                +{confirmedList.length - MAX_VISIBLE_AVATARS}
              </button>
            )}
          </div>
          {reserveList.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                 Резерв ({reserveList.length}/{getReserveLimit(event.max_participants, event.reserve_limit)})
              </p>
              <div className="flex items-center">
                {reserveList.slice(0, MAX_VISIBLE_AVATARS).map((p, i) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProfile(p.profile)}
                    className="relative rounded-full border-2 border-background hover:z-20 transition-transform hover:scale-110"
                    style={{ marginLeft: i === 0 ? 0 : -10, zIndex: MAX_VISIBLE_AVATARS - i }}
                  >
                    <Avatar className="w-8 h-8">
                      {p.profile?.avatar_url ? (
                        <AvatarImage src={p.profile.avatar_url} alt={p.profile?.name} />
                      ) : null}
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs font-semibold">
                        {p.profile?.name?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                ))}
                {reserveList.length > MAX_VISIBLE_AVATARS && (
                  <button
                    onClick={() => setShowAllParticipants(true)}
                    className="relative w-8 h-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-semibold text-muted-foreground hover:bg-accent transition-colors"
                    style={{ marginLeft: -10, zIndex: 0 }}
                  >
                    +{reserveList.length - MAX_VISIBLE_AVATARS}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Delete button for organizer */}
        {isOrganizer && (
          <Button
            variant="ghost"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteDialog(true)}
          >
            <Trash2 className="w-4 h-4 mr-1" />
            Удалить событие
          </Button>
        )}

        {/* All participants dialog */}
        <Dialog open={showAllParticipants} onOpenChange={setShowAllParticipants}>
          <DialogContent className="max-w-sm max-h-[70vh] overflow-y-auto">
            <h3 className="font-semibold mb-3">Все участники ({confirmedList.length})</h3>
            <div className="space-y-2">
              {confirmedList.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProfile(p.profile); setShowAllParticipants(false); }}
                  className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors text-left"
                >
                  <Avatar className="w-10 h-10">
                    {p.profile?.avatar_url ? <AvatarImage src={p.profile.avatar_url} /> : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {p.profile?.name?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium">{p.profile?.name || "Участник"}</span>
                </button>
              ))}
            </div>
            {reserveList.length > 0 && (
              <>
                <h4 className="font-semibold text-sm mt-4 mb-2 text-muted-foreground">Резерв ({reserveList.length})</h4>
                <div className="space-y-2">
                  {reserveList.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => { setSelectedProfile(p.profile); setShowAllParticipants(false); }}
                      className="flex items-center gap-3 w-full p-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <Avatar className="w-10 h-10">
                        {p.profile?.avatar_url ? <AvatarImage src={p.profile.avatar_url} /> : null}
                        <AvatarFallback className="bg-muted text-muted-foreground text-sm font-semibold">
                          {p.profile?.name?.[0]?.toUpperCase() || "?"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium">{p.profile?.name || "Участник"}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        {/* Profile preview dialog */}
        <Dialog open={!!selectedProfile} onOpenChange={(open) => !open && setSelectedProfile(null)}>
          <DialogContent className="max-w-xs text-center">
            <div className="flex flex-col items-center gap-3 py-2">
              <Avatar className="w-20 h-20">
                {selectedProfile?.avatar_url ? (
                  <AvatarImage src={selectedProfile.avatar_url} alt={selectedProfile?.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-semibold">
                  {selectedProfile?.name?.[0]?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <h3 className="font-semibold text-lg">{selectedProfile?.name || "Участник"}</h3>
              {selectedProfile?.bio && (
                <p className="text-sm text-muted-foreground">{selectedProfile.bio}</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Publish confirmation */}
      <AlertDialog open={publishDialog} onOpenChange={setPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Публикация события</AlertDialogTitle>
            <AlertDialogDescription>
              Вы хотите опубликовать событие?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет</AlertDialogCancel>
            <AlertDialogAction onClick={handlePublish}>Да</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unpublish confirmation */}
      <AlertDialog open={unpublishDialog} onOpenChange={setUnpublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Снятие с публикации</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите снять событие с публикации?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Нет</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnpublish}>Да</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удаление события</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить событие? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bottom actions */}
      <div className="fixed bottom-14 left-0 right-0 p-4 bg-background/95 backdrop-blur-sm border-t">
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
              {myStatus === "reserve" && participants.filter((p) => p.status === "confirmed").length < event.max_participants ? (
                <Button className="flex-1" onClick={() => handleJoin(false)}>
                  Записаться
                </Button>
              ) : (
                <Button variant="destructive" className="flex-1" onClick={handleCancel}>
                  <XCircle className="w-4 h-4 mr-1" />
                  Отменить запись
                </Button>
              )}
            </>
          ) : (() => {
            const cCount = participants.filter((p) => p.status === "confirmed").length;
            const rCount = participants.filter((p) => p.status === "reserve").length;
            const rLimit = getReserveLimit(event.max_participants, event.reserve_limit);
            const mainFull = cCount >= event.max_participants;
            const reserveFull = rCount >= rLimit;

            if (event.status !== "published") {
              return <Button className="flex-1" disabled>Запись недоступна</Button>;
            }

            if (!mainFull) {
              return <Button className="flex-1" onClick={() => handleJoin(false)}>Записаться</Button>;
            }

            if (!reserveFull) {
              return <Button className="flex-1" variant="secondary" onClick={() => handleJoin(true)}>Записаться в резервный список</Button>;
            }

            return <Button className="flex-1" disabled>Мест нет</Button>;
          })()}
        </div>
      </div>
      <TabBar />
    </div>
  );
}