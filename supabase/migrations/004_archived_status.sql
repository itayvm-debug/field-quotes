-- ================================================================
-- Migration 004 — Add 'archived' status + admin-only permanent delete
--
-- Changes:
--   1. quotes.status CHECK: add 'archived' to allowed values
--   2. quotes_delete RLS: restrict to admin only
--        (was: user can delete own OR admin; now: admin only)
--        regular users archive instead (status → 'archived')
--   3. company_settings: seed default_exclusions if currently empty
--
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

BEGIN;

-- ── Step 1: Expand status CHECK to include 'archived' ────────────────────────

DO $$
DECLARE
  v_constraint TEXT;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint
  WHERE conrelid = 'public.quotes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%status%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.quotes DROP CONSTRAINT ' || quote_ident(v_constraint);
  END IF;
END;
$$;

ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_status_check
  CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'archived'));

-- ── Step 2: Restrict permanent DELETE to admin only ──────────────────────────
--
-- Before: user_id = auth.uid() OR get_my_role() = 'admin'
-- After:  get_my_role() = 'admin'  (users archive; only admin hard-deletes)

DROP POLICY IF EXISTS "quotes_delete" ON public.quotes;

CREATE POLICY "quotes_delete"
  ON public.quotes FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

-- ── Step 3: Seed default_exclusions (only if currently empty) ────────────────

UPDATE public.company_settings
SET default_exclusions =
  E'ההצעה אינה כוללת עבודות שלא צוינו במפורש.\n' ||
  E'ההצעה אינה כוללת טיפול בתשתיות נסתרות שלא סומנו מראש.\n' ||
  E'ההצעה כפופה לאישור המזמין ולתיאום גישה לאתר.'
WHERE singleton_key = 1
  AND (default_exclusions IS NULL OR default_exclusions = '');

-- ── Verify ────────────────────────────────────────────────────────────────────
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'public.quotes'::regclass AND contype = 'c';
--
-- SELECT default_exclusions FROM company_settings WHERE singleton_key = 1;
--
-- ================================================================

COMMIT;
