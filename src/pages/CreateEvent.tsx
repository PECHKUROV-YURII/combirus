import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { EVENT_CATEGORIES, EVENT_LEVELS } from "@/lib/categories";
import { ArrowLeft } from "lucide-react";

export default function CreateEvent() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [level, setLevel] = useState("any");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [address, setAddress] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [isPrivate, setIsPrivate] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const [price, setPrice] = useState("");

  if (!user) {
    navigate("/auth");
    return null;
  }

  // Check subscription for paid events
  const canCreatePaid = profile?.subscription_plan !== "free";

  const handleSubmit = async () => {
    if (!title.trim() || !startDate || !startTime || !endDate || !endTime || !address.trim()) {
      toast.error("Заполните обязательные поля");
      return;
    }

    const startDatetime = new Date(`${startDate}T${startTime}`).toISOString();
    const endDatetime = new Date(`${endDate}T${endTime}`).toISOString();

    if (new Date(endDatetime) <= new Date(startDatetime)) {
      toast.error("Дата окончания должна быть позже даты начала");
      return;
    }

    if (isPaid && !canCreatePaid) {
      toast.error("Для создания платных событий нужна подписка Premium");
      return;
    }

    setLoading(true);

    const maxParts = parseInt(maxParticipants) || 10;
    const reserveLimit = Math.round(maxParts * 0.2);

    const { data, error } = await supabase
      .from("events")
      .insert({
        title: title.trim(),
        description: description.trim() || null,
        category,
        level,
        start_datetime: startDatetime,
        end_datetime: endDatetime,
        address_text: address.trim(),
        max_participants: maxParts,
        reserve_limit: reserveLimit,
        is_private: isPrivate,
        private_invite_link: isPrivate ? crypto.randomUUID() : null,
        is_paid: isPaid,
        price: isPaid ? parseFloat(price) || 0 : 0,
        payment_type: "onsite",
        organizer_user_id: user.id,
        cover_images: [],
      })
      .select()
      .single();

    setLoading(false);

    if (error) {
      toast.error("Ошибка создания события");
      console.error(error);
    } else {
      toast.success("Событие создано!");
      navigate(`/event/${data.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background safe-top pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Создать событие</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        <div className="space-y-2">
          <Label>Категория *</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Название *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название события" />
        </div>

        <div className="space-y-2">
          <Label>Описание</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Расскажите о событии" rows={3} />
        </div>

        <div className="space-y-2">
          <Label>Обложка события</Label>
          <Input type="file" accept="image/*" className="cursor-pointer" />
          <p className="text-xs text-muted-foreground">Необязательно. Рекомендуемый размер: 16:9</p>
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-4">
          <Label className="text-sm font-semibold">Продолжительность события *</Label>
          
          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">С</span>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-muted-foreground">До</span>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Адрес *</Label>
          <Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Адрес проведения" />
        </div>

        <div className="space-y-2">
          <Label>Макс. участников</Label>
          <Input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(e.target.value)} min="2" />
        </div>

        <div className="flex items-center justify-between py-2">
          <Label>Приватное событие</Label>
          <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <Label>Платное событие</Label>
            {!canCreatePaid && (
              <p className="text-xs text-muted-foreground">Требуется Premium подписка</p>
            )}
          </div>
          <Switch checked={isPaid} onCheckedChange={setIsPaid} disabled={!canCreatePaid} />
        </div>

        {isPaid && (
          <div className="space-y-2">
            <Label>Цена (₽)</Label>
            <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" />
          </div>
        )}

        <Button className="w-full h-12" onClick={handleSubmit} disabled={loading}>
          {loading ? "Создание..." : "Создать событие"}
        </Button>
      </div>
    </div>
  );
}
