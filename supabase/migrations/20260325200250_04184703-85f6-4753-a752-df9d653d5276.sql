
DROP POLICY "Users can update own participation" ON public.event_participants;

CREATE POLICY "Users or organizers can update participation"
ON public.event_participants
FOR UPDATE
TO public
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_participants.event_id
    AND events.organizer_user_id = auth.uid()
  )
);
