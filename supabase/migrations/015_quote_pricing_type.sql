ALTER TABLE public.quotes
ADD COLUMN IF NOT EXISTS quote_pricing_type text;

NOTIFY pgrst, 'reload schema';
