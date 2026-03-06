
-- Drop the old SELECT policy on events
DROP POLICY IF EXISTS "Events viewable" ON public.events;

-- Recreate with invite link access for private events
CREATE POLICY "Events viewable" ON public.events
FOR SELECT TO authenticated, anon
USING (
  (is_private = false)
  OR (auth.uid() = organizer_user_id)
  OR (EXISTS (
    SELECT 1 FROM event_participants
    WHERE event_participants.event_id = events.id
    AND event_participants.user_id = auth.uid()
  ))
  OR (is_private = true AND private_invite_link IS NOT NULL)
);
