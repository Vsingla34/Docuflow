-- ============================================================================
-- Strict tenant (company) isolation – backend enforcement
-- Run in the Supabase SQL Editor AFTER multi_company_migration.sql and
-- user_management.sql. Safe to re-run.
--
-- Why this is needed
--   * fix_rls.sql re-created `USING (true)` read policies and role-only write
--     policies on locations/departments. Postgres ORs permissive policies, so
--     those silently re-opened every company's rows to every logged-in user.
--   * profiles / user_companies / create_app_user were Superadmin-only, so a
--     company Admin could neither see nor create users of THEIR company.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Remove the global (non company-aware) policies left behind by fix_rls.sql
-- ----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Allow read access to all authenticated users on locations"   ON public.locations;
DROP POLICY IF EXISTS "Allow read access to all authenticated users on departments" ON public.departments;
DROP POLICY IF EXISTS "Allow read access to all authenticated users on vendors"     ON public.vendors;
DROP POLICY IF EXISTS "Allow read access to all authenticated users on employees"   ON public.employees;
DROP POLICY IF EXISTS "Allow read access to all authenticated users on assets"      ON public.assets;
DROP POLICY IF EXISTS "Allow read access to all authenticated users on upload_history" ON public.upload_history;

DROP POLICY IF EXISTS "Allow insert masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow update masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow write to masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow insert masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow update masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow write to masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow write to masters for Admin/Management" ON public.vendors;
DROP POLICY IF EXISTS "Allow write to assets for Admin/Management"  ON public.assets;

-- ----------------------------------------------------------------------------
-- 2. Company-aware policies (re-created so they are guaranteed to exist)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['locations', 'departments', 'vendors', 'employees', 'assets', 'upload_history']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Tenant read %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant manage %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant fence %1$s" ON public.%1$I', t);

    EXECUTE format(
      'CREATE POLICY "Tenant read %1$s" ON public.%1$I FOR SELECT TO authenticated
         USING (public.has_company_access(company_id))', t);

    EXECUTE format(
      'CREATE POLICY "Tenant manage %1$s" ON public.%1$I FOR ALL TO authenticated
         USING (public.has_company_access(company_id)
                AND public.get_user_role() IN (''Superadmin'', ''Admin'', ''Management''))
         WITH CHECK (public.has_company_access(company_id)
                AND public.get_user_role() IN (''Superadmin'', ''Admin'', ''Management''))', t);

    -- RESTRICTIVE policies are AND-ed with every permissive policy. Even if some other
    -- script later adds a permissive "allow all" policy, rows of other companies stay hidden.
    EXECUTE format(
      'CREATE POLICY "Tenant fence %1$s" ON public.%1$I AS RESTRICTIVE FOR ALL TO authenticated
         USING (public.has_company_access(company_id))
         WITH CHECK (public.has_company_access(company_id))', t);
  END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 3. Company-scoped visibility of users
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.shares_company_with(target UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_companies mine
    JOIN public.user_companies theirs ON theirs.company_id = mine.company_id
    WHERE mine.user_id = auth.uid() AND theirs.user_id = target
  );
$$;

-- Admin / Management can see the profiles of people in THEIR companies only.
DROP POLICY IF EXISTS "Company staff read company profiles" ON public.profiles;
CREATE POLICY "Company staff read company profiles" ON public.profiles
FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Management') AND public.shares_company_with(id));

-- Admin can activate / deactivate (and edit) non-superadmin users of THEIR companies.
DROP POLICY IF EXISTS "Admin updates company profiles" ON public.profiles;
CREATE POLICY "Admin updates company profiles" ON public.profiles
FOR UPDATE TO authenticated
USING (public.get_user_role() = 'Admin' AND role <> 'Superadmin' AND id <> auth.uid() AND public.shares_company_with(id))
WITH CHECK (role <> 'Superadmin' AND public.shares_company_with(id));

-- Admin / Management can see who is assigned to their companies.
DROP POLICY IF EXISTS "Company staff read company assignments" ON public.user_companies;
CREATE POLICY "Company staff read company assignments" ON public.user_companies
FOR SELECT TO authenticated
USING (public.get_user_role() IN ('Admin', 'Management') AND public.has_company_access(company_id));

-- ----------------------------------------------------------------------------
-- 4. create_app_user(): creates the login AND assigns it to a company atomically.
--    * Superadmin: any company, any role except Superadmin.
--    * Admin: only companies they belong to, any role except Superadmin.
--    A new user is therefore always bound to the creating company.
-- ----------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.create_app_user(TEXT, TEXT, TEXT, user_role, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_app_user(
  p_email       TEXT,
  p_password    TEXT,
  p_full_name   TEXT,
  p_role        user_role,
  p_phone       TEXT DEFAULT NULL,
  p_designation TEXT DEFAULT NULL,
  p_company_id  UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_user_id UUID := gen_random_uuid();
  v_email   TEXT := lower(trim(p_email));
  v_caller  user_role := public.current_app_role();
BEGIN
  IF v_caller IS NULL OR v_caller NOT IN ('Superadmin', 'Admin') THEN
    RAISE EXCEPTION 'Only a Superadmin or Admin can create users' USING ERRCODE = '42501';
  END IF;

  IF p_role NOT IN ('Admin', 'Management', 'Employee', 'Auditor') THEN
    RAISE EXCEPTION 'Role % cannot be assigned', p_role;
  END IF;

  -- Tenant rule: non-superadmins must create users inside a company they belong to.
  IF v_caller = 'Admin' THEN
    IF p_company_id IS NULL OR NOT public.has_company_access(p_company_id) THEN
      RAISE EXCEPTION 'You can only create users inside your own company' USING ERRCODE = '42501';
    END IF;
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

  INSERT INTO auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(), v_user_id, v_user_id::text,
    jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true),
    'email', now(), now(), now()
  );

  INSERT INTO public.profiles (id, email, full_name, role, phone, designation, created_by)
  VALUES (v_user_id, v_email, trim(p_full_name), p_role, p_phone, p_designation, auth.uid());

  IF p_company_id IS NOT NULL THEN
    INSERT INTO public.user_companies (user_id, company_id) VALUES (v_user_id, p_company_id);
  END IF;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, user_role, TEXT, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, user_role, TEXT, TEXT, UUID) TO authenticated;
