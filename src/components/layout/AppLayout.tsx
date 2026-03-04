import { Outlet } from "react-router-dom";
import { TabBar } from "./TabBar";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-background">
      <div className="pb-16">
        <Outlet />
      </div>
      <footer className="text-center text-xs text-muted-foreground py-2">Test commit</footer>
      <TabBar />
    </div>
  );
}
