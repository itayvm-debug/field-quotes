ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS project_image_path    text,
  ADD COLUMN IF NOT EXISTS project_image_caption text,
  ADD COLUMN IF NOT EXISTS project_image_fit     text NOT NULL DEFAULT 'cover';

NOTIFY pgrst, 'reload schema';
