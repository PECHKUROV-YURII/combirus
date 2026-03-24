
-- Allow service role to delete event chat messages (edge function uses service role key, bypasses RLS)
-- Add DELETE policy for event_chat_messages so organizers can also delete
CREATE POLICY "Organizers can delete chat messages"
ON public.event_chat_messages
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_chat_messages.event_id
    AND events.organizer_user_id = auth.uid()
  )
);
