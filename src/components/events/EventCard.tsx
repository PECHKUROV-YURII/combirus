import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { MapPin, Users, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getCategoryLabel } from "@/lib/categories";
import { Badge } from "@/components/ui/badge";

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
  };
}

export function EventCard({ event }: EventCardProps) {
  const navigate = useNavigate();
  const confirmed = event.confirmed_count ?? 0;

  return (
    <button
      onClick={() => navigate(`/event/${event.id}`)}
      className="w-full text-left bg-card rounded-xl overflow-hidden shadow-sm border transition-shadow hover:shadow-md"
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
      <div className="p-3 space-y-1.5">
        <h3 className="font-semibold text-sm line-clamp-1">{event.title}</h3>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>
            {format(new Date(event.start_datetime), "d MMM, HH:mm", { locale: ru })}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPin className="w-3.5 h-3.5" />
          <span className="line-clamp-1">{event.address_text}</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Users className="w-3.5 h-3.5" />
          <span>{confirmed}/{event.max_participants}</span>
          {!event.is_paid && (
            <Badge variant="outline" className="text-[10px] ml-auto px-1.5 py-0">
              Бесплатно
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
