import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MapPin, Users, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCategoryLabel } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-muted text-muted-foreground" },
  published: { label: "Опубликовано", className: "bg-primary/10 text-primary border-primary/20" },
  unpublished: { label: "Снято с публикации", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

interface EventCardProps {
  event: {
    id: string;
    title: string;
    category: string;
    start_datetime: string;
    address_text: string;
    max_participants: number;
    is_paid: boolean;
    price: number | null;
    cover_images: string[];
    confirmed_count?: number;
    status?: string;
    // Fields needed for copy
    description?: string | null;
    end_datetime?: string | null;
    is_private?: boolean | null;
    is_recurring?: boolean | null;
    lat?: number | null;
    lng?: number | null;
    level?: string | null;
    location_id?: string | null;
    organizer_user_id?: string;
    payment_type?: string | null;
    reserve_limit?: number;
    recurrence_rule?: string | null;
  };
  showStatus?: boolean;
  onCopied?: () => void;
}

export function EventCard({ event, showStatus, onCopied }: EventCardProps) {
  const navigate = useNavigate();
  const confirmed = event.confirmed_count ?? 0;
  const statusInfo = event.status ? statusConfig[event.status] : undefined;

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();

    // Determine copy title
    const baseTitle = event.title.replace(/ копия( \d+)?$/, "");
    
    // Count existing copies
    const { data: existing } = await supabase
      .from("events")
      .select("title")
      .eq("organizer_user_id", event.organizer_user_id!)
      .like("title", `${baseTitle} копия%`);

    let newTitle: string;
    if (!existing || existing.length === 0) {
      newTitle = `${baseTitle} копия`;
    } else {
      newTitle = `${baseTitle} копия ${existing.length + 1}`;
    }

    const { error } = await supabase.from("events").insert({
      title: newTitle,
      category: event.category,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      address_text: event.address_text,
      max_participants: event.max_participants,
      is_paid: event.is_paid,
      price: event.price,
      cover_images: event.cover_images,
      description: event.description,
      is_private: event.is_private,
      is_recurring: event.is_recurring,
      lat: event.lat,
      lng: event.lng,
      level: event.level,
      location_id: event.location_id,
      organizer_user_id: event.organizer_user_id!,
      payment_type: event.payment_type,
      reserve_limit: event.reserve_limit ?? 2,
      recurrence_rule: event.recurrence_rule,
      status: "draft",
    });

    if (error) {
      toast.error("Ошибка копирования");
    } else {
      toast.success("Копия создана");
      onCopied?.();
    }
  };

  return (
    <div className="w-full bg-card rounded-xl overflow-hidden shadow-sm border transition-shadow hover:shadow-md">
      <button
        onClick={() => navigate(`/event/${event.id}`)}
        className="w-full text-left"
      >
        <div className="aspect-[16/9] bg-muted relative overflow-hidden">
          {event.cover_images?.[0] ? (
            <img
              src={event.cover_images[0]}
              alt={event.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <Calendar className="w-10 h-10" />
            </div>
          )}
          <div className="absolute top-2 left-2">
            <Badge variant="secondary" className="text-xs bg-card/90 backdrop-blur-sm">
              {getCategoryLabel(event.category)}
            </Badge>
          </div>
          {event.is_paid && (
            <div className="absolute top-2 right-2">
              <Badge className="text-xs bg-primary text-primary-foreground">
                {event.price} ₽
              </Badge>
            </div>
          )}
        </div>
      </button>
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={() => navigate(`/event/${event.id}`)}
            className="flex-1 min-w-0 text-left space-y-1.5"
          >
            <h3 className="font-semibold text-sm line-clamp-1">{event.title}</h3>
            {showStatus && statusInfo && (
              <Badge className={`text-[10px] ${statusInfo.className}`}>{statusInfo.label}</Badge>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3.5 h-3.5 shrink-0" />
              <span>
                {format(new Date(event.start_datetime), "d MMM, HH:mm", { locale: ru })}
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              <span className="line-clamp-1">{event.address_text}</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>{confirmed}/{event.max_participants}</span>
              {!event.is_paid && (
                <Badge variant="outline" className="text-[10px] ml-auto px-1.5 py-0">
                  Бесплатно
                </Badge>
              )}
            </div>
          </button>
          {showStatus && (
            <button
              onClick={handleCopy}
              className="shrink-0 text-xs text-primary font-medium px-2 py-1.5 rounded-lg hover:bg-primary/10 transition-colors whitespace-nowrap"
            >
              Сделать копию
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
