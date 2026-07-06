-- migration 013: price adjustments per quote
-- Ordered list of percentage-based additions/discounts applied sequentially.
-- Default empty array ensures backward compat with all existing quotes.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS price_adjustments JSONB NOT NULL DEFAULT '[]'::jsonb;
