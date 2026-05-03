-- ================================================================
-- Field Quotes — Migration 001 — Initial Schema
-- Run this in: Supabase Dashboard → SQL Editor
-- ================================================================


-- ================================================================
-- SECTION 1: HELPER FUNCTIONS
-- ================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN COALESCE(
    (SELECT role FROM profiles WHERE id = auth.uid()),
    'user'
  );
END;
$$;


-- ================================================================
-- SECTION 2: TABLES
-- ================================================================

CREATE TABLE profiles (
  id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name  TEXT        NOT NULL DEFAULT '',
  role       TEXT        NOT NULL DEFAULT 'user'
               CHECK (role IN ('user', 'admin', 'manager', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE company_settings (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton_key         INTEGER     NOT NULL DEFAULT 1 UNIQUE
                          CONSTRAINT only_one_company_row CHECK (singleton_key = 1),
  company_name          TEXT        NOT NULL DEFAULT '',
  company_id_number     TEXT        NOT NULL DEFAULT '',
  address               TEXT        NOT NULL DEFAULT '',
  phone                 TEXT        NOT NULL DEFAULT '',
  email                 TEXT        NOT NULL DEFAULT '',
  logo_storage_path     TEXT,
  footer_text           TEXT        NOT NULL DEFAULT '',
  default_payment_terms TEXT        NOT NULL DEFAULT '',
  default_exclusions    TEXT        NOT NULL DEFAULT '',
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER company_settings_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO company_settings (singleton_key, company_name) VALUES (1, '');


CREATE TABLE quote_number_seq (
  year    INTEGER PRIMARY KEY,
  counter INTEGER NOT NULL DEFAULT 0
);


CREATE TABLE quotes (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID         NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  quote_number        TEXT         UNIQUE,
  status              TEXT         NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
  client_name         TEXT         NOT NULL DEFAULT '',
  client_address      TEXT         NOT NULL DEFAULT '',
  client_contact      TEXT         NOT NULL DEFAULT '',
  project_description TEXT         NOT NULL DEFAULT '',
  quote_date          DATE         NOT NULL DEFAULT CURRENT_DATE,
  valid_until         DATE,
  payment_terms       TEXT         NOT NULL DEFAULT '',
  exclusions          TEXT         NOT NULL DEFAULT '',
  vat_percentage      NUMERIC(5,2) NOT NULL DEFAULT 18,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TRIGGER quotes_updated_at
  BEFORE UPDATE ON quotes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE quote_items (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id     UUID          NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_number  INTEGER       NOT NULL,
  description  TEXT          NOT NULL DEFAULT '',
  unit         TEXT          NOT NULL DEFAULT 'יח׳',
  quantity     NUMERIC(12,3) NOT NULL DEFAULT 0,
  unit_price   NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes        TEXT          NOT NULL DEFAULT '',
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (quote_id, item_number)
);

CREATE TRIGGER quote_items_updated_at
  BEFORE UPDATE ON quote_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


CREATE TABLE item_images (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id        UUID        NOT NULL REFERENCES quote_items(id) ON DELETE CASCADE,
  storage_path   TEXT        NOT NULL,
  include_in_pdf BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order  INTEGER     NOT NULL DEFAULT 0,
  caption        TEXT        NOT NULL DEFAULT '',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ================================================================
-- SECTION 3: INDEXES
-- ================================================================
CREATE INDEX idx_quotes_user_id      ON quotes(user_id);
CREATE INDEX idx_quotes_status       ON quotes(status);
CREATE INDEX idx_quotes_date         ON quotes(quote_date DESC);
CREATE INDEX idx_quote_items_quote   ON quote_items(quote_id);
CREATE INDEX idx_quote_items_order   ON quote_items(quote_id, item_number);
CREATE INDEX idx_item_images_item    ON item_images(item_id);
CREATE INDEX idx_item_images_pdf     ON item_images(item_id) WHERE include_in_pdf = TRUE;


-- ================================================================
-- SECTION 4: QUOTE NUMBER GENERATION
-- ================================================================

CREATE OR REPLACE FUNCTION next_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  yr           INTEGER := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;
  next_counter INTEGER;
BEGIN
  INSERT INTO quote_number_seq (year, counter)
  VALUES (yr, 1)
  ON CONFLICT (year) DO UPDATE
    SET counter = quote_number_seq.counter + 1
  RETURNING counter INTO next_counter;

  RETURN 'Q-' || yr::TEXT || '-' || LPAD(next_counter::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION trigger_set_quote_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Always overwrite — user-supplied quote_number is ignored
  NEW.quote_number := next_quote_number();
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_quote_number
  BEFORE INSERT ON quotes
  FOR EACH ROW
  EXECUTE FUNCTION trigger_set_quote_number();


-- ================================================================
-- SECTION 5: AUTO-CREATE PROFILE ON SIGNUP
-- ================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();


-- ================================================================
-- SECTION 6: ROLE ESCALATION PROTECTION
-- ================================================================

CREATE OR REPLACE FUNCTION prevent_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF get_my_role() <> 'admin' THEN
      RAISE EXCEPTION
        'permission denied: only admin can change user roles (attempted: % → %)',
        OLD.role, NEW.role
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_role_protection
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION prevent_role_escalation();


-- ================================================================
-- SECTION 7: ROW LEVEL SECURITY
-- ================================================================

ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_number_seq ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE item_images      ENABLE ROW LEVEL SECURITY;

-- profiles
CREATE POLICY "profiles_select"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'admin');

CREATE POLICY "profiles_update"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR get_my_role() = 'admin')
  WITH CHECK (id = auth.uid() OR get_my_role() = 'admin');

-- company_settings
CREATE POLICY "company_settings_select"
  ON company_settings FOR SELECT TO authenticated USING (true);

CREATE POLICY "company_settings_insert"
  ON company_settings FOR INSERT TO authenticated
  WITH CHECK (get_my_role() = 'admin');

CREATE POLICY "company_settings_update"
  ON company_settings FOR UPDATE TO authenticated
  USING    (get_my_role() = 'admin')
  WITH CHECK (get_my_role() = 'admin');

-- quote_number_seq: blocked — access only via SECURITY DEFINER functions
CREATE POLICY "quote_number_seq_block_all"
  ON quote_number_seq FOR ALL USING (false);

-- quotes
CREATE POLICY "quotes_select"
  ON quotes FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR get_my_role() IN ('admin', 'manager', 'viewer'));

CREATE POLICY "quotes_insert"
  ON quotes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'));

CREATE POLICY "quotes_update"
  ON quotes FOR UPDATE TO authenticated
  USING    (user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
  WITH CHECK (user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'));

CREATE POLICY "quotes_delete"
  ON quotes FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR get_my_role() = 'admin');

-- quote_items
CREATE POLICY "quote_items_select"
  ON quote_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager', 'viewer'))
    )
  );

CREATE POLICY "quote_items_insert"
  ON quote_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
    )
  );

CREATE POLICY "quote_items_update"
  ON quote_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
    )
  );

CREATE POLICY "quote_items_delete"
  ON quote_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q WHERE q.id = quote_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
    )
  );

-- item_images
CREATE POLICY "item_images_select"
  ON item_images FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = item_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager', 'viewer'))
    )
  );

CREATE POLICY "item_images_insert"
  ON item_images FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = item_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
    )
  );

CREATE POLICY "item_images_update"
  ON item_images FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = item_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = item_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
    )
  );

CREATE POLICY "item_images_delete"
  ON item_images FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quote_items qi JOIN quotes q ON q.id = qi.quote_id
      WHERE qi.id = item_id
        AND (q.user_id = auth.uid() OR get_my_role() IN ('admin', 'manager'))
    )
  );


-- ================================================================
-- SECTION 8: STORAGE BUCKETS + POLICIES
--
-- Path conventions:
--   quote-images/{user_id}/{quote_id}/{item_id}/{filename}
--   company-assets/logo/{filename}
--
-- NOTE: Storage path = physical file protection.
--       item_images RLS  = logical relation protection (item→quote→user).
--       Both layers are required together.
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES
  ('quote-images',   'quote-images',   false, 10485760),
  ('company-assets', 'company-assets', false,  5242880)
ON CONFLICT (id) DO NOTHING;

-- quote-images: SELECT
CREATE POLICY "storage_quote_images_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'quote-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR get_my_role() IN ('admin', 'manager', 'viewer')
    )
  );

-- quote-images: INSERT
CREATE POLICY "storage_quote_images_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'quote-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR get_my_role() IN ('admin', 'manager')
    )
  );

-- quote-images: UPDATE
CREATE POLICY "storage_quote_images_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'quote-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR get_my_role() IN ('admin', 'manager')
    )
  );

-- quote-images: DELETE — manager CANNOT delete physical files
CREATE POLICY "storage_quote_images_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'quote-images'
    AND (
      (storage.foldername(name))[1] = auth.uid()::TEXT
      OR get_my_role() = 'admin'
    )
  );

-- company-assets: SELECT (all authenticated)
CREATE POLICY "storage_company_assets_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'company-assets');

-- company-assets: write = admin only
CREATE POLICY "storage_company_assets_insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-assets' AND get_my_role() = 'admin');

CREATE POLICY "storage_company_assets_update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'company-assets' AND get_my_role() = 'admin');

CREATE POLICY "storage_company_assets_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'company-assets' AND get_my_role() = 'admin');


-- ================================================================
-- SECTION 9: FUNCTION PERMISSIONS
-- ================================================================

REVOKE EXECUTE ON FUNCTION set_updated_at()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION next_quote_number()        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION trigger_set_quote_number() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION handle_new_user()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION prevent_role_escalation()  FROM PUBLIC;

REVOKE EXECUTE ON FUNCTION get_my_role() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_my_role() TO authenticated;

-- ================================================================
-- END OF MIGRATION 001
-- ================================================================
