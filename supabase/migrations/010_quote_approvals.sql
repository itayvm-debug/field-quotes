-- ================================================================
-- Field Quotes — Migration 010 — Quote Approvals
-- Run in: Supabase Dashboard → SQL Editor
-- DO NOT run without owner approval
--
-- Creates:
--   • public.quote_approvals  — approval document records
--   • storage bucket          — quote-approvals (private, 20 MB)
--   • storage policies        — select/insert/delete on storage.objects
--   • RLS policies            — select/insert/delete on quote_approvals
--
-- Storage path convention: {quote_owner_user_id}/{quote_id}/{filename}
--   The root segment is always the QUOTE OWNER's user_id, not the
--   uploader's id. Admin uploads go through the server-side service
--   role client, which bypasses RLS and ensures the path is correct.
-- ================================================================

BEGIN;

-- ── 1. TABLE ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quote_approvals (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     uuid        NOT NULL REFERENCES public.quotes(id)    ON DELETE CASCADE,
  uploaded_by  uuid        NOT NULL REFERENCES public.profiles(id),
  storage_path text        NOT NULL,
  file_name    text        NOT NULL,
  file_type    text,
  note         text        NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ── 2. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_quote_approvals_quote_id
  ON public.quote_approvals(quote_id);

CREATE INDEX IF NOT EXISTS idx_quote_approvals_uploaded_by
  ON public.quote_approvals(uploaded_by);

-- ── 3. RLS — quote_approvals ─────────────────────────────────────────────────

ALTER TABLE public.quote_approvals ENABLE ROW LEVEL SECURITY;

-- SELECT: quote owner sees approvals for their quotes; admin sees all
DROP POLICY IF EXISTS "quote_approvals_select" ON public.quote_approvals;
CREATE POLICY "quote_approvals_select"
  ON public.quote_approvals FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_approvals.quote_id
        AND q.user_id = auth.uid()
    )
  );

-- INSERT: uploader = caller AND (owner of the quote OR admin)
DROP POLICY IF EXISTS "quote_approvals_insert" ON public.quote_approvals;
CREATE POLICY "quote_approvals_insert"
  ON public.quote_approvals FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND (
      get_my_role() = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.quotes q
        WHERE q.id = quote_approvals.quote_id
          AND q.user_id = auth.uid()
      )
    )
  );

-- DELETE: admin only
DROP POLICY IF EXISTS "quote_approvals_delete" ON public.quote_approvals;
CREATE POLICY "quote_approvals_delete"
  ON public.quote_approvals FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── 4. STORAGE BUCKET ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'quote-approvals',
  'quote-approvals',
  false,
  20971520,   -- 20 MB
  ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/heic', 'image/heif', 'image/gif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public             = false,
  file_size_limit    = 20971520,
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
    'image/heic', 'image/heif', 'image/gif',
    'application/pdf'
  ];

-- ── 5. STORAGE POLICIES — storage.objects ────────────────────────────────────
--
-- Path: {quote_owner_user_id}/{quote_id}/{filename}
-- (storage.foldername(name))[1] = first path segment = quote owner's user_id
--
-- SELECT: files whose root folder matches caller's uid, OR admin
DROP POLICY IF EXISTS "storage_quote_approvals_select" ON storage.objects;
CREATE POLICY "storage_quote_approvals_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'quote-approvals'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR get_my_role() = 'admin'
    )
  );

-- INSERT: caller uploads to their own folder root, OR admin.
-- Admin uploads done server-side via service role (bypasses RLS);
-- this policy is a defense-in-depth layer.
DROP POLICY IF EXISTS "storage_quote_approvals_insert" ON storage.objects;
CREATE POLICY "storage_quote_approvals_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-approvals'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR get_my_role() = 'admin'
    )
  );

-- DELETE: admin only
DROP POLICY IF EXISTS "storage_quote_approvals_delete" ON storage.objects;
CREATE POLICY "storage_quote_approvals_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'quote-approvals'
    AND get_my_role() = 'admin'
  );

COMMIT;

-- ================================================================
-- END OF MIGRATION 010
-- ================================================================
