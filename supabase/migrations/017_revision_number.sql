ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS revision_number integer NOT NULL DEFAULT 0;

NOTIFY pgrst, 'reload schema';
