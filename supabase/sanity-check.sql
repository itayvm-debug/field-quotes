-- ================================================================
-- Field Quotes — RLS Sanity Check Queries
-- Run each block separately in Supabase SQL Editor (service_role mode)
-- to verify policies behave as expected.
-- ================================================================


-- ================================================================
-- SETUP: Create two test users via Supabase Auth UI first, then:
-- Replace the UUIDs below with real user IDs from auth.users
-- ================================================================
-- USER_A_ID = <uuid of regular user>
-- USER_B_ID = <uuid of another regular user>
-- VIEWER_ID = <uuid of a user you will set role='viewer'>
-- ADMIN_ID  = <uuid of a user you will set role='admin'>


-- ================================================================
-- STEP 1: Set up roles
-- (Run as service_role in SQL Editor — bypasses RLS)
-- ================================================================

-- Make one user an admin (replace with real UUID)
-- UPDATE profiles SET role = 'admin' WHERE id = '<ADMIN_ID>';

-- Make one user a viewer
-- UPDATE profiles SET role = 'viewer' WHERE id = '<VIEWER_ID>';


-- ================================================================
-- TEST 1: User A creates a quote
-- Expected: quote is created with auto-generated quote_number
-- ================================================================
-- Run in the app as User A, or via REST with User A's JWT.
-- Then verify:
SELECT id, quote_number, user_id, status FROM quotes ORDER BY created_at DESC LIMIT 5;


-- ================================================================
-- TEST 2: User B cannot see User A's quote
-- Simulate: set RLS context to User B and try to SELECT User A's quote
-- ================================================================

-- In SQL Editor, RLS is bypassed by default (service_role).
-- To test RLS, use the Supabase client with User B's JWT, or run:
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<USER_B_ID>", "role": "authenticated"}';

SELECT * FROM quotes; -- Should return ONLY User B's quotes (empty if B has none)

RESET role;


-- ================================================================
-- TEST 3: User A cannot escalate own role to admin
-- Expected: RAISE EXCEPTION 'permission denied: only admin can change user roles'
-- ================================================================
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<USER_A_ID>", "role": "authenticated"}';

-- This MUST fail with SQLSTATE 42501:
UPDATE profiles SET role = 'admin' WHERE id = '<USER_A_ID>';

RESET role;


-- ================================================================
-- TEST 4: Viewer cannot insert/update/delete quotes
-- Expected: all three statements fail with RLS violation
-- ================================================================
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<VIEWER_ID>", "role": "authenticated"}';

-- INSERT — must fail:
INSERT INTO quotes (user_id, client_name) VALUES ('<VIEWER_ID>', 'Test');

-- UPDATE — must fail (even on a quote the viewer can see):
UPDATE quotes SET client_name = 'Hacked' WHERE id = '<SOME_QUOTE_ID>';

-- DELETE — must fail:
DELETE FROM quotes WHERE id = '<SOME_QUOTE_ID>';

RESET role;


-- ================================================================
-- TEST 5: User A cannot access quote_items of User B's quote
-- Expected: empty result even if item UUID is known
-- ================================================================
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claims TO '{"sub": "<USER_A_ID>", "role": "authenticated"}';

-- Replace with a real item_id belonging to User B's quote:
SELECT * FROM quote_items WHERE id = '<USER_B_ITEM_ID>';
-- Expected: 0 rows

RESET role;


-- ================================================================
-- TEST 6: Quote numbering is sequential and global
-- ================================================================
-- Create 3 quotes (as any users) and verify:
SELECT quote_number FROM quotes ORDER BY created_at LIMIT 10;
-- Expected: Q-YYYY-0001, Q-YYYY-0002, Q-YYYY-0003 ...

-- Attempt to insert with a manual quote_number (should be ignored):
-- INSERT INTO quotes (user_id, quote_number) VALUES ('<USER_A_ID>', 'MANUAL-99');
-- SELECT quote_number FROM quotes ORDER BY created_at DESC LIMIT 1;
-- Expected: Q-YYYY-000X (auto-generated, not MANUAL-99)


-- ================================================================
-- TEST 7: company_settings is singleton
-- ================================================================
-- Try to insert a second row — must fail with unique constraint:
INSERT INTO company_settings (singleton_key, company_name) VALUES (1, 'Duplicate');
-- Expected: ERROR: duplicate key value violates unique constraint "only_one_company_row"

-- ================================================================
-- END OF SANITY CHECKS
-- ================================================================
