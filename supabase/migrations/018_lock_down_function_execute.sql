-- Migration 018 — restrict who can call internal SECURITY DEFINER functions
--
-- Supabase advisors flagged these functions as callable through
-- /rest/v1/rpc/* by the anon (not signed in) and authenticated roles.
-- The app never calls them via RPC; they run only from triggers or RLS.
--
--   * Trigger-only functions: triggers do not check EXECUTE when they fire,
--     so revoking it from API roles changes nothing for the app.
--   * next_quote_number: called only by trigger_set_quote_number, which is
--     SECURITY DEFINER (runs as owner), so the owner's EXECUTE is enough.
--     Previously anyone could call it and burn daily quote numbers.
--   * get_my_role: used by RLS policies for signed-in users, so
--     authenticated keeps EXECUTE; only anon is revoked.
--
-- Also pins search_path on the two plain trigger helpers (advisor 0011).
-- Idempotent: REVOKE/ALTER can be re-run safely.

REVOKE EXECUTE ON FUNCTION public.handle_new_user()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_role_escalation()  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_set_quote_number() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.next_quote_number(date)    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role()              FROM anon;

ALTER FUNCTION public.set_updated_at()          SET search_path = '';
ALTER FUNCTION public.update_quote_timestamps() SET search_path = '';

NOTIFY pgrst, 'reload schema';
