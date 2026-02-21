import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { LogOut, Star, Settings, Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Tab = "profile" | "settings";

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("profile");
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile?.name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [city, setCity] = useState(profile?.city || "");
  const [saving, setSaving] = useState(false);

  if (!user) {
    navigate("/auth");
    return null;
  }

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ name, bio, city })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Ошибка сохранения");
    } else {
      toast.success("Профиль обновлён");
      setEditing(false);
      refreshProfile();
    }
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
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xl font-bold">
            {profile?.name?.[0]?.toUpperCase() || "?"}
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
                  <Button onClick={handleSave} disabled={saving} className="flex-1">
                    {saving ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)} className="flex-1">
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
