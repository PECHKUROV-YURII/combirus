import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import Onboarding from "./pages/Onboarding";
import Auth from "./pages/Auth";
import HomePage from "./pages/HomePage";
import SearchPage from "./pages/SearchPage";
import CreateEvent from "./pages/CreateEvent";
import ChatsPage from "./pages/ChatsPage";
import EventChat from "./pages/EventChat";
import ProfilePage from "./pages/ProfilePage";
import EventDetail from "./pages/EventDetail";
import FavoritesPage from "./pages/FavoritesPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import InvitePage from "./pages/InvitePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Onboarding />} />
            <Route path="/auth" element={<Auth />} />
            <Route element={<AppLayout />}>
              <Route path="/home" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/create" element={<CreateEvent />} />
              <Route path="/chats" element={<ChatsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
            </Route>
            <Route path="/event/:id" element={<EventDetail />} />
            <Route path="/event/:id/chat" element={<EventChat />} />
            <Route path="/favorites" element={<FavoritesPage />} />
            <Route path="/subscription" element={<SubscriptionPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
