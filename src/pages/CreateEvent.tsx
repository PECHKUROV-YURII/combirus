import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
import { ArrowLeft, ImagePlus } from "lucide-react";

export default function CreateEvent() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");
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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [existingCoverImages, setExistingCoverImages] = useState<string[]>([]);

  useEffect(() => {
    if (!editId) return;
    const fetchEvent = async () => {
      const { data } = await supabase.from("events").select("*").eq("id", editId).single();
      if (!data) return;
      setTitle(data.title);
      setDescription(data.description || "");
      setCategory(data.category);
      setLevel(data.level || "any");
      setAddress(data.address_text);
      setMaxParticipants(String(data.max_participants));
      setIsPrivate(data.is_private || false);
      setIsPaid(data.is_paid || false);
      setPrice(data.price ? String(data.price) : "");
      if (data.start_datetime) {
        const s = new Date(data.start_datetime);
        setStartDate(s.toISOString().slice(0, 10));
        setStartTime(s.toISOString().slice(11, 16));
      }
      if (data.end_datetime) {
        const e = new Date(data.end_datetime);
        setEndDate(e.toISOString().slice(0, 10));
        setEndTime(e.toISOString().slice(11, 16));
      }
      if (data.cover_images && data.cover_images.length > 0) {
        setExistingCoverImages(data.cover_images);
        setCoverPreview(data.cover_images[0]);
      }
    };
    fetchEvent();
  }, [editId]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const canCreatePaid = profile?.subscription_plan !== "free";

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Максимальный размер файла — 5 МБ");
      return;
    }
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
  };

  const uploadCover = async (): Promise<string[]> => {
    if (!coverFile) return [];
    const ext = coverFile.name.split(".").pop();
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("event-covers").upload(path, coverFile);
    if (error) {
      console.error("Upload error:", error);
      toast.error("Ошибка загрузки обложки");
      return [];
    }
    const { data: urlData } = supabase.storage.from("event-covers").getPublicUrl(path);
    return [urlData.publicUrl];
  };

  const handleSubmit = async () => {
    if (!category || !title.trim() || !startDate || !startTime || !endDate || !endTime || !address.trim()) {
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

    let coverImages: string[];
    if (coverFile) {
      coverImages = await uploadCover();
    } else {
      coverImages = existingCoverImages;
    }

    const maxParts = parseInt(maxParticipants) || 10;
    const reserveLimit = Math.round(maxParts * 0.2);

    const eventData = {
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
      payment_type: "onsite" as const,
      cover_images: coverImages,
    };

    let result;
    if (editId) {
      result = await supabase.from("events").update(eventData).eq("id", editId).select().single();
    } else {
      result = await supabase.from("events").insert({
        ...eventData,
        organizer_user_id: user.id,
        status: "draft",
      }).select().single();
    }

    setLoading(false);

    if (result.error) {
      toast.error(editId ? "Ошибка обновления события" : "Ошибка создания события");
      console.error(result.error);
    } else {
      toast.success(editId ? "Событие обновлено!" : "Черновик события создан!");
      navigate(`/event/${result.data.id}`);
    }
  };

  return (
    <div className="min-h-screen bg-background safe-top pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">{editId ? "Редактировать событие" : "Создать событие"}</h1>
      </div>

      <div className="px-4 py-4 space-y-4 max-w-lg mx-auto">
        {/* 1. Категория */}
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

        {/* 2. Название */}
        <div className="space-y-2">
          <Label>Название *</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Название события" />
        </div>

        {/* 3. Описание */}
        <div className="space-y-2">
          <Label>Описание</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Расскажите о событии" rows={3} />
        </div>

        {/* 4. Обложка */}
        <div className="space-y-2">
          <Label>Обложка события</Label>
          {coverPreview ? (
            <div className="relative rounded-xl overflow-hidden">
              <img src={coverPreview} alt="Обложка" className="w-full aspect-video object-cover" />
              <button
                type="button"
                onClick={() => { setCoverFile(null); setCoverPreview(null); setExistingCoverImages([]); }}
                className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm rounded-full p-1.5 text-foreground"
              >
                ✕
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-primary/50 transition-colors">
              <ImagePlus className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Нажмите для загрузки</span>
              <span className="text-xs text-muted-foreground">Макс. 5 МБ • 16:9</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCoverChange} />
            </label>
          )}
        </div>

        {/* 5. Уровень */}
        <div className="space-y-2">
          <Label>Уровень</Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {EVENT_LEVELS.map((l) => (
                <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 6. Продолжительность */}
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

        {/* Остальные поля */}
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
