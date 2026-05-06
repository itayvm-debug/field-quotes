-- ================================================================
-- Migration 003 — Change quote number format to DDMMYYYY-XX
--
-- OLD format: Q-2026-0005  (yearly counter from quote_number_seq)
-- NEW format: 03052026-01  (date of quote + daily 2-digit counter)
--
-- Implementation strategy:
--   New table: quote_number_daily_seq
--     Primary key: date_str TEXT (DDMMYYYY)
--     counter increments atomically via INSERT … ON CONFLICT DO UPDATE
--   This single-operation approach is race-condition-safe without locks.
--
-- Existing quotes:
--   Left untouched — keep their Q-YYYY-XXXX numbers.
--   The UNIQUE constraint on quote_number still holds because the
--   formats are completely different and cannot collide.
--
-- Old table quote_number_seq:
--   Kept (not dropped) for safety. It is no longer written to.
--   Optional cleanup at bottom of this file (commented out).
--
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

BEGIN;

-- ── Step 1: Remove old trigger ────────────────────────────────────────────────
DROP TRIGGER IF EXISTS auto_quote_number ON quotes;

-- ── Step 2: Remove old functions ─────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.trigger_set_quote_number();
DROP FUNCTION IF EXISTS public.next_quote_number();

-- ── Step 3: Create daily sequence table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS quote_number_daily_seq (
  date_str  TEXT    PRIMARY KEY,   -- DDMMYYYY  e.g. '03052026'
  counter   INTEGER NOT NULL DEFAULT 0
);

-- ── Step 4: RLS — never accessible directly, only via SECURITY DEFINER ───────
ALTER TABLE quote_number_daily_seq ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'quote_number_daily_seq'
      AND policyname = 'daily_seq_block_all'
  ) THEN
    EXECUTE 'CREATE POLICY daily_seq_block_all
             ON quote_number_daily_seq FOR ALL USING (false)';
  END IF;
END;
$$;

-- ── Step 5: New number generator ─────────────────────────────────────────────
--
--   INSERT … ON CONFLICT DO UPDATE … RETURNING is a single atomic
--   statement in PostgreSQL.  No advisory locks needed.
--   Two concurrent transactions on the same date_str will serialize
--   at the row level: one gets counter=N, the other gets counter=N+1.
--
CREATE OR REPLACE FUNCTION next_quote_number(p_date DATE DEFAULT CURRENT_DATE)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_date_str TEXT;
  v_counter  INTEGER;
BEGIN
  v_date_str := TO_CHAR(p_date, 'DDMMYYYY');

  INSERT INTO quote_number_daily_seq (date_str, counter)
  VALUES (v_date_str, 1)
  ON CONFLICT (date_str) DO UPDATE
    SET counter = quote_number_daily_seq.counter + 1
  RETURNING counter INTO v_counter;

  RETURN v_date_str || '-' || LPAD(v_counter::TEXT, 2, '0');
END;
$$;

-- ── Step 6: Trigger function ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trigger_set_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Uses quote_date if provided, otherwise today
  NEW.quote_number := next_quote_number(COALESCE(NEW.quote_date, CURRENT_DATE));
  RETURN NEW;
END;
$$;

-- ── Step 7: Recreate trigger ──────────────────────────────────────────────────
CREATE TRIGGER auto_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_quote_number();

-- ── Step 8: Permissions ───────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.next_quote_number(DATE)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_set_quote_number() FROM PUBLIC;

-- ── Notes ─────────────────────────────────────────────────────────────────────
--
-- Existing quotes:
--   No changes. Q-2026-XXXX numbers stay as-is.
--
-- Old quote_number_seq table:
--   Still exists but is no longer written to.
--   To remove it later (after you've verified everything works):
--
--     DROP TABLE quote_number_seq;
--
-- Quick test after running:
--   INSERT INTO quotes (user_id, quote_date)
--     VALUES ('<your-user-uuid>', CURRENT_DATE);
--   SELECT quote_number FROM quotes ORDER BY created_at DESC LIMIT 3;
--   Expected: 03052026-01, 03052026-02, etc.
--
-- ================================================================

COMMIT;
