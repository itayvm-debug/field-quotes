-- Add pricing_mode and manual_total to quotes table.
-- pricing_mode: 'items' (default, existing behaviour) or 'overall' (single manual total).
-- manual_total: the manually-entered overall price when pricing_mode = 'overall'.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'items',
  ADD COLUMN IF NOT EXISTS manual_total numeric;

NOTIFY pgrst, 'reload schema';
