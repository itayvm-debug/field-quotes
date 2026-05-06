BEGIN;

-- Add job_title and signature_storage_path to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_storage_path TEXT;

-- Create private user-signatures bucket (2MB limit)
-- ON CONFLICT DO UPDATE ensures idempotency if run again
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('user-signatures', 'user-signatures', false, 2097152)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = 2097152;

-- Drop existing policies first (safe to re-run)
DROP POLICY IF EXISTS "user_signatures_select" ON storage.objects;
DROP POLICY IF EXISTS "user_signatures_insert" ON storage.objects;
DROP POLICY IF EXISTS "user_signatures_update" ON storage.objects;
DROP POLICY IF EXISTS "user_signatures_delete" ON storage.objects;

-- Storage RLS for user-signatures
-- Path convention: {user_id}/{filename}
-- Users manage their own files; admin/manager can read all for PDF generation

CREATE POLICY "user_signatures_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'user-signatures'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR get_my_role() IN ('admin', 'manager')
    )
  );

CREATE POLICY "user_signatures_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'user-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_signatures_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'user-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "user_signatures_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'user-signatures'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMIT;
