-- ================================================================
-- Field Quotes — Migration 011 — Payment Update Requests
-- Run in: Supabase Dashboard → SQL Editor
-- DO NOT run without owner approval
--
-- Creates:
--   • public.payment_update_requests — pending/approved/rejected payment requests
--   • Unique partial index           — one pending request per quote
--   • RLS policies                   — select/insert/update
--
-- Business logic:
--   • user submits a payment change → row inserted with request_status = 'pending'
--   • quotes.payment_status does NOT change until admin approves
--   • admin approves → request_status = 'approved', quotes updated by API
--   • admin rejects → request_status = 'rejected', quotes unchanged
--   • unique index on (quote_id) WHERE pending prevents duplicate open requests
-- ================================================================

BEGIN;

-- ── 1. TABLE ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.payment_update_requests (
  id                            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id                      uuid          NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  requested_by                  uuid          NOT NULL REFERENCES public.profiles(id),
  requested_at                  timestamptz   NOT NULL DEFAULT now(),

  -- Requested payment values (what the user wants to set)
  requested_payment_status      text          NOT NULL
    CHECK (requested_payment_status IN ('unpaid', 'partial', 'paid', 'closed_partial')),
  requested_paid_amount         numeric(12,2) NOT NULL DEFAULT 0,
  requested_closed_payment_note text          NOT NULL DEFAULT '',
  requested_overpayment_note    text          NOT NULL DEFAULT '',
  requester_note                text          NOT NULL DEFAULT '',

  -- Request lifecycle
  request_status                text          NOT NULL DEFAULT 'pending'
    CHECK (request_status IN ('pending', 'approved', 'rejected', 'superseded')),

  -- Set by admin on review
  reviewed_by                   uuid          REFERENCES public.profiles(id),
  reviewed_at                   timestamptz,
  admin_note                    text          NOT NULL DEFAULT ''
);

-- ── 2. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_payment_requests_quote_id
  ON public.payment_update_requests(quote_id);

CREATE INDEX IF NOT EXISTS idx_payment_requests_status
  ON public.payment_update_requests(request_status);

CREATE INDEX IF NOT EXISTS idx_payment_requests_requested_by
  ON public.payment_update_requests(requested_by);

-- Fast lookup: pending requests ordered by time (admin inbox view)
CREATE INDEX IF NOT EXISTS idx_payment_requests_pending_at
  ON public.payment_update_requests(requested_at DESC)
  WHERE request_status = 'pending';

-- ENFORCE: at most one pending request per quote at any time.
-- If a user tries to re-submit while a pending request exists,
-- the DB raises a unique constraint violation → the API returns
-- "כבר קיימת בקשת תשלום שממתינה לאישור אדמין".
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_requests_one_pending_per_quote
  ON public.payment_update_requests(quote_id)
  WHERE request_status = 'pending';

-- ── 3. RLS — payment_update_requests ─────────────────────────────────────────

ALTER TABLE public.payment_update_requests ENABLE ROW LEVEL SECURITY;

-- SELECT: own requests OR requests for own quotes OR admin sees all
DROP POLICY IF EXISTS "payment_requests_select" ON public.payment_update_requests;
CREATE POLICY "payment_requests_select"
  ON public.payment_update_requests FOR SELECT TO authenticated
  USING (
    get_my_role() = 'admin'
    OR requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = payment_update_requests.quote_id
        AND q.user_id = auth.uid()
    )
  );

-- INSERT: user creates requests only for their own quotes.
-- Admins update quotes directly — they do not create requests.
DROP POLICY IF EXISTS "payment_requests_insert" ON public.payment_update_requests;
CREATE POLICY "payment_requests_insert"
  ON public.payment_update_requests FOR INSERT TO authenticated
  WITH CHECK (
    requested_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = payment_update_requests.quote_id
        AND q.user_id = auth.uid()
    )
  );

-- UPDATE: admin only — approves or rejects; user cannot touch request_status.
DROP POLICY IF EXISTS "payment_requests_update" ON public.payment_update_requests;
CREATE POLICY "payment_requests_update"
  ON public.payment_update_requests FOR UPDATE TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- No DELETE policy → history is preserved indefinitely.

COMMIT;

-- ================================================================
-- END OF MIGRATION 011
-- ================================================================
