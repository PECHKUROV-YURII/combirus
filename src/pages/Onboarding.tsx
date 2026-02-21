import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Search, LogIn } from "lucide-react";

export default function Onboarding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-background">
      <div className="w-full max-w-sm space-y-10 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="text-primary">Combi</span>
          </h1>
          <p className="text-muted-foreground">
            Находи мероприятия рядом с тобой
          </p>
        </div>

        <div className="space-y-3">
          <Button
            className="w-full h-12 text-base"
            variant="default"
            onClick={() => navigate("/search")}
          >
            <Search className="w-5 h-5 mr-2" />
            Искать события
          </Button>
          <Button
            className="w-full h-12 text-base"
            variant="outline"
            onClick={() => navigate("/auth")}
          >
            <LogIn className="w-5 h-5 mr-2" />
            Войти
          </Button>
        </div>
      </div>
    </div>
  );
}
