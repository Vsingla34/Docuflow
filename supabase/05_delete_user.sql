-- ============================================================================
-- Docuflow: Delete User Function
-- ============================================================================

-- Function to completely delete a user from the system.
-- Only the Superadmin can invoke this.
CREATE OR REPLACE FUNCTION public.delete_app_user(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Authorisation: only an active Superadmin may call this
  IF NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Only a Superadmin can completely delete users' USING ERRCODE = '42501';
  END IF;

  -- Delete from auth.users (this will CASCADE to public.profiles, user_companies, etc.)
  DELETE FROM auth.users WHERE id = p_user_id;

END;
$$;

REVOKE ALL ON FUNCTION public.delete_app_user(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_app_user(UUID) TO authenticated;

-- Function to remove a user from a specific company workspace
-- A company Admin or Superadmin can invoke this
CREATE OR REPLACE FUNCTION public.remove_user_from_company(
  p_user_id UUID,
  p_company_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- Authorisation: User must be Superadmin or an Admin of the specific company
  IF NOT public.has_company_access(p_company_id) THEN
    RAISE EXCEPTION 'You do not have access to manage users in this company' USING ERRCODE = '42501';
  END IF;

  IF NOT public.is_superadmin() AND public.get_user_role() != 'Admin' THEN
    RAISE EXCEPTION 'Only an Admin or Superadmin can remove users' USING ERRCODE = '42501';
  END IF;

  -- Remove the link
  DELETE FROM public.user_companies 
  WHERE user_id = p_user_id AND company_id = p_company_id;

END;
$$;

REVOKE ALL ON FUNCTION public.remove_user_from_company(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_user_from_company(UUID, UUID) TO authenticated;
