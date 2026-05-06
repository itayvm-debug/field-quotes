BEGIN;

-- Payment tracking columns
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CONSTRAINT quotes_payment_status_check CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'closed_partial')),
  ADD COLUMN IF NOT EXISTS paid_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_note     TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS closed_payment_note TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_closed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_closed_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Trigger: auto-stamp timestamps on status transitions
CREATE OR REPLACE FUNCTION public.update_quote_timestamps()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'accepted' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.approved_at := NOW();
  END IF;
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM NEW.status THEN
    NEW.rejected_at := NOW();
  END IF;
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    NEW.paid_at := NOW();
  END IF;
  IF NEW.payment_status = 'closed_partial' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    NEW.payment_closed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS quotes_status_timestamps ON public.quotes;
CREATE TRIGGER quotes_status_timestamps
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_quote_timestamps();

REVOKE EXECUTE ON FUNCTION public.update_quote_timestamps() FROM PUBLIC;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_quotes_payment_status
  ON public.quotes(payment_status);
CREATE INDEX IF NOT EXISTS idx_quotes_payment_status_accepted
  ON public.quotes(payment_status) WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_quotes_approved_at
  ON public.quotes(approved_at DESC) WHERE approved_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_paid_at
  ON public.quotes(paid_at DESC) WHERE paid_at IS NOT NULL;

COMMIT;
