import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "free",
    name: "Free",
    price: "Бесплатно",
    features: ["Запись на события", "Создание бесплатных событий"],
    disabled: ["Платные события", "Своя локация"],
  },
  {
    id: "premium_creator",
    name: "Premium Creator",
    price: "290 ₽/мес",
    features: ["Запись на события", "Бесплатные и платные события"],
    disabled: ["Своя локация"],
  },
  {
    id: "premium_location",
    name: "Premium Location",
    price: "990 ₽/мес",
    features: ["Запись на события", "Бесплатные и платные события", "Своя офлайн-локация"],
    disabled: [],
  },
];

export default function SubscriptionPage() {
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const handleSelect = async (planId: string) => {
    if (!user) return;
    const { error } = await supabase
      .from("profiles")
      .update({ subscription_plan: planId })
      .eq("user_id", user.id);
    if (error) {
      toast.error("Ошибка");
    } else {
      toast.success("Тариф обновлён (MVP — без оплаты)");
      refreshProfile();
    }
  };

  return (
    <div className="min-h-screen bg-background safe-top pb-20">
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-semibold">Подписка</h1>
      </div>

      <div className="px-4 py-4 space-y-3">
        {plans.map((plan) => {
          const isActive = profile?.subscription_plan === plan.id;
          return (
            <div
              key={plan.id}
              className={cn(
                "rounded-xl border p-4 space-y-3 transition-colors",
                isActive && "border-primary bg-primary/5"
              )}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="text-sm text-primary font-medium">{plan.price}</p>
                </div>
                {isActive && (
                  <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                    Активен
                  </span>
                )}
              </div>
              <div className="space-y-1">
                {plan.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <Check className="w-3.5 h-3.5 text-primary" />
                    <span>{f}</span>
                  </div>
                ))}
                {plan.disabled.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground line-through">
                    <span className="w-3.5" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              {!isActive && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleSelect(plan.id)}
                >
                  Выбрать
                </Button>
              )}
            </div>
          );
        })}
        <p className="text-xs text-muted-foreground text-center">
          В MVP оплата не реализована — тариф переключается флагом
        </p>
      </div>
    </div>
  );
}
