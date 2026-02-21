import { Home, Search, PlusCircle, MessageCircle, User } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const tabs = [
  { path: "/home", icon: Home, label: "Домой" },
  { path: "/search", icon: Search, label: "Поиск" },
  { path: "/create", icon: PlusCircle, label: "Создать" },
  { path: "/chats", icon: MessageCircle, label: "Чат" },
  { path: "/profile", icon: User, label: "Профиль" },
];

export function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-card safe-bottom">
      <div className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.path);
          const isCreate = tab.path === "/create";
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
                isCreate && "relative"
              )}
            >
              {isCreate ? (
                <div className="w-11 h-11 -mt-5 rounded-full bg-primary flex items-center justify-center shadow-lg">
                  <PlusCircle className="w-6 h-6 text-primary-foreground" />
                </div>
              ) : (
                <>
                  <tab.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
