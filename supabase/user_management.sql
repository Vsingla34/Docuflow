CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- -----------------------------------------------------------------------------
-- 1. PROFILES – one row per login account, holds the app role
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  full_name   TEXT NOT NULL,
  role        user_role NOT NULL DEFAULT 'Employee',
  phone       TEXT,
  designation TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- 2. BOOTSTRAP – promote the already-existing account(s) to Superadmin.
--    At this point the only auth user is the Superadmin you created manually.
-- -----------------------------------------------------------------------------
INSERT INTO public.profiles (id, email, full_name, role)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)), 'Superadmin'
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 3. HELPERS (SECURITY DEFINER avoids RLS recursion)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() AND is_active LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.current_app_role() = 'Superadmin', false);
$$;

-- Make the existing get_user_role() (used by other RLS policies) read from profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.current_app_role();
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS POLICIES ON PROFILES
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users read own profile"          ON public.profiles;
DROP POLICY IF EXISTS "Superadmin reads all profiles"   ON public.profiles;
DROP POLICY IF EXISTS "Superadmin updates profiles"     ON public.profiles;

CREATE POLICY "Users read own profile"        ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Superadmin reads all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_superadmin());
CREATE POLICY "Superadmin updates profiles"   ON public.profiles FOR UPDATE TO authenticated
  USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());
-- No INSERT / DELETE policy: rows are only created through create_app_user().

-- -----------------------------------------------------------------------------
-- 5. create_app_user() – Superadmin-only RPC that creates a login + profile
--    Called from the app via:  supabase.rpc('create_app_user', {...})
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_app_user(
  p_email       TEXT,
  p_password    TEXT,
  p_full_name   TEXT,
  p_role        user_role,
  p_phone       TEXT DEFAULT NULL,
  p_designation TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_email   TEXT := lower(trim(p_email));
BEGIN
  -- Authorisation: only an active Superadmin may call this
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a Superadmin can create users' USING ERRCODE = '42501';
  END IF;

  -- Hierarchy: Superadmin can create all roles except Superadmin
  IF p_role NOT IN ('Admin', 'Management', 'Employee', 'Auditor') THEN
    RAISE EXCEPTION 'Role % cannot be assigned', p_role;
  END IF;

  IF v_email IS NULL OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Invalid email address';
  END IF;

  IF length(coalesce(p_password, '')) < 8 THEN
    RAISE EXCEPTION 'Password must be at least 8 characters';
  END IF;

  IF coalesce(trim(p_full_name), '') = '' THEN
    RAISE EXCEPTION 'Full name is required';
  END IF;

  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'A user with email % already exists', v_email;
  END IF;

  -- Auth user (pre-confirmed so they can log in immediately)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000', v_user_id, 'authenticated', 'authenticated',
    v_email, crypt(p_password, gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    jsonb_build_object('full_name', trim(p_full_name), 'role', p_role::text),
    now(), now(),
    '', '', '', ''
  );

  -- Email identity (required for email/password sign-in)
  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  -- App profile with role
  INSERT INTO public.profiles (id, email, full_name, role, phone, designation, created_by)
  VALUES (v_user_id, v_email, trim(p_full_name), p_role, p_phone, p_designation, auth.uid());

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, user_role, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, user_role, TEXT, TEXT) TO authenticated;
