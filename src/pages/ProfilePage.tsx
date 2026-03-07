import { useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import { LogOut, Star, Settings, Heart, Camera, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tab = "profile" | "settings";

// Avatar specs: 400×400px, max 2MB, JPG/PNG/WebP
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVATAR_SIZE = 400;

async function resizeImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = AVATAR_SIZE;
      canvas.height = AVATAR_SIZE;
      const ctx = canvas.getContext("2d")!;

      // Center-crop to square
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [city, setCity] = useState(profile?.city || "");
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const currentAvatarUrl = avatarPreview || profile?.avatar_url || null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      toast.error("Поддерживаются только JPG, PNG и WebP");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Максимальный размер файла — 2 МБ");
      return;
    }

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return profile?.avatar_url || null;

    setUploading(true);
    try {
      const resized = await resizeImage(avatarFile);
      const filePath = `${user.id}/avatar.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, resized, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      // Cache bust
      return `${data.publicUrl}?t=${Date.now()}`;
    } catch (err: any) {
      toast.error("Ошибка загрузки аватара");
      console.error(err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    let avatar_url = profile?.avatar_url || null;
    if (avatarFile) {
      const uploaded = await uploadAvatar();
      if (uploaded) avatar_url = uploaded;
    }

    const { error } = await supabase
      .from("profiles")
      .update({ name, bio, city, avatar_url })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      toast.success("Профиль обновлён");
      setEditing(false);
      setAvatarFile(null);
      setAvatarPreview(null);
      refreshProfile();
    }
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setAvatarFile(null);
    setAvatarPreview(null);
    setName(profile?.name || "");
    setBio(profile?.bio || "");
    setCity(profile?.city || "");
  };

  const planLabel = {
    free: "Free",
    premium_creator: "Premium Creator",
    premium_location: "Premium Location",
  }[profile?.subscription_plan || "free"];

  return (
    <div className="min-h-screen bg-background safe-top">
      <div className="px-4 pt-4 pb-6">
        {/* Avatar and name */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Avatar className="w-16 h-16">
              {currentAvatarUrl ? (
                <AvatarImage src={currentAvatarUrl} alt={profile?.name || ""} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
                {profile?.name?.[0]?.toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>
            {editing && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>
          <div>
            <h1 className="text-lg font-bold">{profile?.name || "Пользователь"}</h1>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="w-3.5 h-3.5 fill-primary text-primary" />
              <span>{profile?.rating_avg || 0}</span>
              <span className="mx-1">·</span>
              <span>{profile?.reviews_count || 0} отзывов</span>
            </div>
            <Badge variant="outline" className="mt-1 text-xs">{planLabel}</Badge>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-4 flex">
        <button
          onClick={() => setTab("profile")}
          className={cn(
            "flex-1 pb-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "profile" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
        >
          Профиль
        </button>
        <button
          onClick={() => setTab("settings")}
          className={cn(
            "flex-1 pb-2.5 text-sm font-medium border-b-2 transition-colors",
            tab === "settings" ? "border-primary text-primary" : "border-transparent text-muted-foreground"
          )}
        >
          Настройки
        </button>
      </div>

      <div className="px-4 py-4">
        {tab === "profile" ? (
          <div className="space-y-4">
            {editing ? (
              <>
                {/* Avatar hint */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
                  <Info className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-foreground mb-1">Требования к фото профиля</p>
                    <ul className="space-y-0.5">
                      <li>• Размер: 400×400 px (автоматическая обрезка)</li>
                      <li>• Формат: JPG, PNG или WebP</li>
                      <li>• Макс. размер файла: 2 МБ</li>
                      <li>• Рекомендация: квадратное фото крупным планом</li>
                    </ul>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Имя</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>О себе</Label>
                  <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Город</Label>
                  <Input value={city} onChange={(e) => setCity(e.target.value)} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving || uploading} className="flex-1">
                    {saving || uploading ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button variant="outline" onClick={handleCancelEdit} className="flex-1">
                    Отмена
                  </Button>
                </div>
              </>
            ) : (
              <>
                {profile?.bio && (
                  <p className="text-sm text-muted-foreground">{profile.bio}</p>
                )}
                {profile?.city && (
                  <p className="text-sm text-muted-foreground">📍 {profile.city}</p>
                )}
                <Button variant="outline" onClick={() => setEditing(true)} className="w-full">
                  Редактировать профиль
                </Button>

                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => navigate("/favorites")}
                >
                  <Heart className="w-4 h-4 mr-2" />
                  Избранное
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() => navigate("/subscription")}
            >
              <Settings className="w-4 h-4 mr-2" />
              Подписка
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Выйти
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
