-- Migration 020 — client book
--
-- * public.clients: one row per client (company-wide), with default contact,
--   email, notes and alias_keys (old/merged names that still map here).
-- * quotes.client_id: link to the client. quotes.client_name stays as the
--   snapshot printed on the quote — PDFs of existing quotes do not change.
-- * Trigger link_quote_client: every insert / client_name change on quotes
--   finds the client by normalized name or alias, creating it if needed.
--   All paths (form, duplicate, future API) are covered without app code.
-- * No automatic fuzzy merging: similar names stay separate until an admin
--   merges them with merge_clients() (source name is kept as an alias).
-- * Backfill links the existing quotes without touching quotes.updated_at.

-- ── Name normalization (trim, collapse spaces, lower-case) ─────────────────
CREATE OR REPLACE FUNCTION public.client_name_key(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = ''
AS $$ SELECT lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')) $$;

-- ── Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  name_key    text        GENERATED ALWAYS AS (public.client_name_key(name)) STORED,
  alias_keys  text[]      NOT NULL DEFAULT '{}',
  contact     text        NOT NULL DEFAULT '',
  email       text        NOT NULL DEFAULT '',
  notes       text        NOT NULL DEFAULT '',
  created_by  uuid,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clients_name_not_blank CHECK (public.client_name_key(name) <> '')
);
CREATE UNIQUE INDEX IF NOT EXISTS clients_name_key_uidx ON public.clients (name_key);
CREATE INDEX IF NOT EXISTS clients_alias_keys_gin ON public.clients USING gin (alias_keys);

ALTER TABLE public.quotes ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_quotes_client_id ON public.quotes (client_id);

-- ── Keep old name as an alias when a client is renamed ─────────────────────
CREATE OR REPLACE FUNCTION public.clients_before_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE
  old_key text := public.client_name_key(OLD.name);
  new_key text := public.client_name_key(NEW.name);
BEGIN
  IF old_key <> new_key THEN
    NEW.alias_keys := ARRAY(
      SELECT DISTINCT k FROM unnest(NEW.alias_keys || old_key) AS k WHERE k <> new_key
    );
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS clients_before_update ON public.clients;
CREATE TRIGGER clients_before_update BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.clients_before_update();

-- ── Link quotes to clients ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_quote_client()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  k   text;
  cid uuid;
BEGIN
  -- Explicit client_id with unchanged name (e.g. merge) is kept as-is
  IF TG_OP = 'UPDATE'
     AND NEW.client_name IS NOT DISTINCT FROM OLD.client_name
     AND NEW.client_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  k := public.client_name_key(NEW.client_name);
  IF k = '' THEN
    NEW.client_id := NULL;
    RETURN NEW;
  END IF;

  SELECT id INTO cid FROM public.clients
   WHERE name_key = k OR k = ANY (alias_keys)
   ORDER BY (name_key = k) DESC
   LIMIT 1;

  IF cid IS NULL THEN
    INSERT INTO public.clients (name, contact, created_by)
    VALUES (btrim(NEW.client_name), coalesce(NEW.client_contact, ''), NEW.user_id)
    ON CONFLICT (name_key) DO NOTHING
    RETURNING id INTO cid;
    IF cid IS NULL THEN
      SELECT id INTO cid FROM public.clients WHERE name_key = k;
    END IF;
  END IF;

  NEW.client_id := cid;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS quotes_link_client ON public.quotes;
CREATE TRIGGER quotes_link_client
  BEFORE INSERT OR UPDATE OF client_name, client_id ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.link_quote_client();

-- ── Merge (admin only) ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.merge_clients(p_source uuid, p_target uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF public.get_my_role() <> 'admin' THEN
    RAISE EXCEPTION 'permission denied: only admin can merge clients' USING ERRCODE = '42501';
  END IF;
  IF p_source = p_target THEN
    RAISE EXCEPTION 'cannot merge a client into itself';
  END IF;

  UPDATE public.clients t
     SET alias_keys = ARRAY(
           SELECT DISTINCT k FROM unnest(t.alias_keys || s.alias_keys || s.name_key) AS k
            WHERE k <> t.name_key)
    FROM public.clients s
   WHERE s.id = p_source AND t.id = p_target;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found';
  END IF;

  UPDATE public.quotes SET client_id = p_target WHERE client_id = p_source;
  DELETE FROM public.clients WHERE id = p_source;
END $$;

REVOKE EXECUTE ON FUNCTION public.link_quote_client()       FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.clients_before_update()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_clients(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.merge_clients(uuid, uuid) TO authenticated;

-- ── RLS: company-wide list; viewers read-only; admin deletes ───────────────
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.clients FROM anon;

DROP POLICY IF EXISTS clients_select ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.get_my_role()) <> 'viewer');

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated
  USING ((SELECT public.get_my_role()) <> 'viewer')
  WITH CHECK ((SELECT public.get_my_role()) <> 'viewer');

DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated
  USING ((SELECT public.get_my_role()) = 'admin');

-- ── Backfill existing quotes (keep updated_at untouched) ───────────────────
INSERT INTO public.clients (name, contact, created_by, created_at)
SELECT DISTINCT ON (public.client_name_key(client_name))
       btrim(client_name), coalesce(client_contact, ''), user_id, created_at
  FROM public.quotes
 WHERE public.client_name_key(client_name) <> ''
 ORDER BY public.client_name_key(client_name), created_at DESC
ON CONFLICT (name_key) DO NOTHING;

ALTER TABLE public.quotes DISABLE TRIGGER quotes_updated_at;
UPDATE public.quotes q
   SET client_id = c.id
  FROM public.clients c
 WHERE q.client_id IS NULL
   AND c.name_key = public.client_name_key(q.client_name);
ALTER TABLE public.quotes ENABLE TRIGGER quotes_updated_at;

NOTIFY pgrst, 'reload schema';
