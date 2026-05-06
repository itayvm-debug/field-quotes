BEGIN;

CREATE TABLE public.support_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name   TEXT        NOT NULL DEFAULT '',
  subject       TEXT        NOT NULL DEFAULT '',
  message       TEXT        NOT NULL DEFAULT '',
  status        TEXT        NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'resolved')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ
);

CREATE INDEX idx_support_requests_user    ON public.support_requests(user_id);
CREATE INDEX idx_support_requests_status  ON public.support_requests(status);
CREATE INDEX idx_support_requests_created ON public.support_requests(created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

-- All authenticated users (including viewer) can submit — must link to their own uid
CREATE POLICY "support_requests_insert"
  ON public.support_requests FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- user/viewer see only their own; admin/manager see all
CREATE POLICY "support_requests_select"
  ON public.support_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'));

-- Only admin can update (e.g. mark resolved)
CREATE POLICY "support_requests_update"
  ON public.support_requests FOR UPDATE TO authenticated
  USING (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- Only admin can delete
CREATE POLICY "support_requests_delete"
  ON public.support_requests FOR DELETE TO authenticated
  USING (get_my_role() = 'admin');

COMMIT;
