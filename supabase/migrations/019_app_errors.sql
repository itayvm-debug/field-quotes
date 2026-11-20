-- Migration 019 — application error log
--
-- Server and client errors are recorded here so they survive Vercel's short
-- log retention (Hobby keeps runtime logs ~30 min). Shown on /admin/errors.
--
-- Writes happen only on the server with the service-role client
-- (lib/errorLog.ts, /api/client-error), so there is no INSERT policy:
-- signed-in users cannot write here directly. Admins can read and clear.
-- Rows older than 90 days are pruned by the logger.

CREATE TABLE IF NOT EXISTS public.app_errors (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source     text        NOT NULL,             -- 'server' | 'client'
  route      text,                             -- request path or screen
  message    text        NOT NULL,
  details    text,                             -- stack / digest (truncated)
  user_id    uuid,                             -- who hit it, when known
  context    jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_errors_created_at ON public.app_errors (created_at DESC);

ALTER TABLE public.app_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_errors_select_admin ON public.app_errors;
CREATE POLICY app_errors_select_admin ON public.app_errors
  FOR SELECT TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin');

DROP POLICY IF EXISTS app_errors_delete_admin ON public.app_errors;
CREATE POLICY app_errors_delete_admin ON public.app_errors
  FOR DELETE TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin');

REVOKE ALL ON public.app_errors FROM anon;

NOTIFY pgrst, 'reload schema';
