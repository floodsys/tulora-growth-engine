-- Drop all current avatar storage policies and recreate them
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar v2" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar v2" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar v2" ON storage.objects;

-- Create simplified storage policies for avatars bucket
CREATE POLICY "Avatar images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload avatars" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND name ~ ('^' || auth.uid()::text || '/')
);

CREATE POLICY "Users can update avatars" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND name ~ ('^' || auth.uid()::text || '/')
);

CREATE POLICY "Users can delete avatars" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'avatars' 
  AND auth.uid() IS NOT NULL
  AND name ~ ('^' || auth.uid()::text || '/')
);