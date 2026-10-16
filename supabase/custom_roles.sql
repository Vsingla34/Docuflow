-- Create custom_roles table
CREATE TABLE IF NOT EXISTS public.custom_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(company_id, name)
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant read custom_roles" ON public.custom_roles
    FOR SELECT TO authenticated
    USING (public.has_company_access(company_id));

CREATE POLICY "Tenant manage custom_roles" ON public.custom_roles
    FOR ALL TO authenticated
    USING (public.has_company_access(company_id) AND public.get_user_role() IN ('Superadmin', 'Admin'))
    WITH CHECK (public.has_company_access(company_id) AND public.get_user_role() IN ('Superadmin', 'Admin'));

-- Add custom_role_id to user_companies
ALTER TABLE public.user_companies ADD COLUMN IF NOT EXISTS custom_role_id UUID REFERENCES public.custom_roles(id) ON DELETE SET NULL;

-- Update create_app_user function to accept custom_role_id
DROP FUNCTION IF EXISTS public.create_app_user(TEXT, TEXT, TEXT, user_role, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.create_app_user(
  p_email       TEXT,
  p_password    TEXT,
  p_full_name   TEXT,
  p_role        user_role,
  p_phone       TEXT DEFAULT NULL,
  p_designation TEXT DEFAULT NULL,
  p_company_id  UUID DEFAULT NULL,
  p_custom_role_id UUID DEFAULT NULL
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
    INSERT INTO public.user_companies (user_id, company_id, custom_role_id) VALUES (v_user_id, p_company_id, p_custom_role_id);
  END IF;

  RETURN v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, user_role, TEXT, TEXT, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_app_user(TEXT, TEXT, TEXT, user_role, TEXT, TEXT, UUID, UUID) TO authenticated;

