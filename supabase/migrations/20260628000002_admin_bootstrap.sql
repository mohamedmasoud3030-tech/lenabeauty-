-- ============================================================
-- LenaBeauty — Admin Bootstrap (run AFTER enabling RLS)
--
-- After RLS is enabled, a user sees NOTHING unless they have:
--   1) a row in profiles
--   2) a row in center_memberships linking them to the center
--   3) user_metadata.role set to ADMIN / MANAGER / STAFF
--      (the frontend mapAuthSession reads user_metadata.role and
--       refuses to default-escalate — no role => unauthorized).
--
-- HOW TO USE:
--   1. Create the auth user first in Supabase Dashboard
--      (Authentication -> Users -> Add user), using the salon
--      owner's email + a password. Copy the new user's UUID.
--   2. Replace :admin_uid below with that UUID and run this file
--      in the SQL Editor.
-- ============================================================

-- Replace this with the real auth.users UUID before running:
-- \set admin_uid '00000000-0000-0000-0000-000000000000'

DO $$
DECLARE
  v_admin_uid UUID := '00000000-0000-0000-0000-000000000000'; -- <-- EDIT ME
  v_center_id UUID := '7f0b8e2a-6d5a-4a1b-9c2d-3e4f5a6b7c8d';  -- matches VITE_CENTER_ID
BEGIN
  IF v_admin_uid = '00000000-0000-0000-0000-000000000000' THEN
    RAISE EXCEPTION 'Set v_admin_uid to the real auth.users UUID before running.';
  END IF;

  -- 1. profile row
  INSERT INTO public.profiles (id, full_name)
  VALUES (v_admin_uid, 'Salon Admin')
  ON CONFLICT (id) DO NOTHING;

  -- 2. link to the center
  INSERT INTO public.center_memberships (profile_id, center_id)
  VALUES (v_admin_uid, v_center_id)
  ON CONFLICT (profile_id, center_id) DO NOTHING;

  -- 3. set the app role in auth metadata (read by mapAuthSession)
  UPDATE auth.users
  SET raw_user_meta_data =
    COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'ADMIN')
  WHERE id = v_admin_uid;
END $$;

-- VERIFY:
--   SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = '<uid>';
--   SELECT * FROM public.center_memberships WHERE profile_id = '<uid>';
