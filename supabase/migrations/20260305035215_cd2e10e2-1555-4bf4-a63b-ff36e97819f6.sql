
-- Create storage bucket for event cover images
INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers', 'event-covers', true);

-- Allow authenticated users to upload files
CREATE POLICY "Auth users can upload event covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-covers');

-- Allow public read access
CREATE POLICY "Event covers are publicly accessible"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-covers');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own event covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-covers' AND (storage.foldername(name))[1] = auth.uid()::text);
