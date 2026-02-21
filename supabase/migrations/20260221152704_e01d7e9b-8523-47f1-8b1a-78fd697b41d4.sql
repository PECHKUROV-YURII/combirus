
-- 1. Create all tables first (no cross-table references in RLS)

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  phone TEXT,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  bio TEXT,
  city TEXT,
  rating_avg NUMERIC(3,2) DEFAULT 0,
  reviews_count INTEGER DEFAULT 0,
  subscription_plan TEXT NOT NULL DEFAULT 'free' CHECK (subscription_plan IN ('free', 'premium_creator', 'premium_location')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  address_text TEXT NOT NULL,
  photos TEXT[] DEFAULT '{}',
  organizer_user_id UUID NOT NULL,
  owner_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  level TEXT DEFAULT 'any',
  is_private BOOLEAN DEFAULT false,
  private_invite_link TEXT UNIQUE,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,
  start_datetime TIMESTAMPTZ NOT NULL,
  end_datetime TIMESTAMPTZ,
  address_text TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  max_participants INTEGER NOT NULL DEFAULT 10,
  reserve_limit INTEGER NOT NULL DEFAULT 2,
  is_paid BOOLEAN DEFAULT false,
  price NUMERIC(10,2) DEFAULT 0,
  payment_type TEXT DEFAULT 'onsite' CHECK (payment_type IN ('onsite', 'online')),
  cover_images TEXT[] NOT NULL DEFAULT '{}',
  organizer_user_id UUID NOT NULL,
  location_id UUID REFERENCES public.locations(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.event_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'reserve', 'cancelled')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE public.event_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  sender_user_id UUID NOT NULL,
  message_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.direct_chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES public.direct_chats(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID NOT NULL,
  to_user_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.favorite_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, event_id)
);

-- 2. Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorite_events ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Profiles
CREATE POLICY "Profiles viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Locations
CREATE POLICY "Locations viewable by everyone" ON public.locations FOR SELECT USING (true);
CREATE POLICY "Auth users can create locations" ON public.locations FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizer_user_id);
CREATE POLICY "Owners can update locations" ON public.locations FOR UPDATE USING (auth.uid() = organizer_user_id OR auth.uid() = owner_user_id);

-- Events
CREATE POLICY "Events viewable" ON public.events FOR SELECT USING (
  is_private = false OR 
  auth.uid() = organizer_user_id OR
  EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = events.id AND user_id = auth.uid())
);
CREATE POLICY "Auth users can create events" ON public.events FOR INSERT TO authenticated WITH CHECK (auth.uid() = organizer_user_id);
CREATE POLICY "Organizers can update events" ON public.events FOR UPDATE USING (auth.uid() = organizer_user_id);
CREATE POLICY "Organizers can delete events" ON public.events FOR DELETE USING (auth.uid() = organizer_user_id);

-- Event participants
CREATE POLICY "Participants viewable by everyone" ON public.event_participants FOR SELECT USING (true);
CREATE POLICY "Auth users can join events" ON public.event_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own participation" ON public.event_participants FOR UPDATE USING (auth.uid() = user_id);

-- Event chat
CREATE POLICY "Event chat viewable by participants" ON public.event_chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = event_chat_messages.event_id AND user_id = auth.uid() AND status IN ('confirmed', 'reserve'))
  OR EXISTS (SELECT 1 FROM public.events WHERE id = event_chat_messages.event_id AND organizer_user_id = auth.uid())
);
CREATE POLICY "Participants can send messages" ON public.event_chat_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_user_id AND (
    EXISTS (SELECT 1 FROM public.event_participants WHERE event_id = event_chat_messages.event_id AND user_id = auth.uid() AND status IN ('confirmed', 'reserve'))
    OR EXISTS (SELECT 1 FROM public.events WHERE id = event_chat_messages.event_id AND organizer_user_id = auth.uid())
  )
);

-- Direct chats
CREATE POLICY "Users can view own chats" ON public.direct_chats FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Auth users can create chats" ON public.direct_chats FOR INSERT TO authenticated WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Direct messages
CREATE POLICY "Users can view messages in own chats" ON public.direct_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.direct_chats WHERE id = direct_messages.chat_id AND (user1_id = auth.uid() OR user2_id = auth.uid()))
);
CREATE POLICY "Users can send messages in own chats" ON public.direct_messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.direct_chats WHERE id = direct_messages.chat_id AND (user1_id = auth.uid() OR user2_id = auth.uid()))
);

-- Reviews
CREATE POLICY "Reviews viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Auth users can create reviews" ON public.reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user_id);

-- Favorites
CREATE POLICY "Users can view own favorites" ON public.favorite_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can add favorites" ON public.favorite_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove favorites" ON public.favorite_events FOR DELETE USING (auth.uid() = user_id);

-- 4. Functions and triggers
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.event_chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
