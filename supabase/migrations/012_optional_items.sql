-- Migration 012 — Add is_optional column to quote_items
-- Ran: 2026-05-15

BEGIN;

ALTER TABLE public.quote_items
  ADD COLUMN IF NOT EXISTS is_optional boolean NOT NULL DEFAULT false;

COMMIT;
