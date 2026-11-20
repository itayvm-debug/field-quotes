-- Migration 021 — personal access tokens for AI agents (MCP server /api/mcp)
--
-- Only the SHA-256 hash of a token is stored; the plain token is shown once
-- when created (/api/tokens) and never again. Tokens act as their owner,
-- can be revoked any time, and record last use.
-- Inserts happen server-side with the service role (no INSERT policy).
-- Users can list their own tokens and set revoked_at — nothing else.

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         text        NOT NULL,
  token_hash   text        NOT NULL UNIQUE,
  token_prefix text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_user_id ON public.api_tokens (user_id);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.api_tokens FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.api_tokens FROM authenticated;
GRANT SELECT ON public.api_tokens TO authenticated;
GRANT UPDATE (revoked_at) ON public.api_tokens TO authenticated;

DROP POLICY IF EXISTS api_tokens_select_own ON public.api_tokens;
CREATE POLICY api_tokens_select_own ON public.api_tokens
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS api_tokens_revoke_own ON public.api_tokens;
CREATE POLICY api_tokens_revoke_own ON public.api_tokens
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
