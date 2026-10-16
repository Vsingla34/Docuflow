-- ============================================================================
-- Docuflow: make asset_categories company-scoped (fixes PGRST204
-- "Could not find the 'company_id' column of 'asset_categories'").
-- Also makes master codes unique PER COMPANY instead of globally.
-- Safe to run more than once. Run in the Supabase SQL editor.
-- ============================================================================

-- 1. company_id on asset_categories (existing rows go to the default company)
ALTER TABLE public.asset_categories
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE
  DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.asset_categories SET company_id = '00000000-0000-0000-0000-000000000001' WHERE company_id IS NULL;
ALTER TABLE public.asset_categories ALTER COLUMN company_id SET NOT NULL;

-- 2. Codes unique per company (not globally), so two companies can both use e.g. "HQ" or "IT"
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['asset_categories', 'locations', 'departments', 'vendors', 'employees']
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT IF EXISTS %I', t, t || '_code_key');
    BEGIN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I UNIQUE (company_id, code)', t, t || '_company_code_key');
    EXCEPTION WHEN duplicate_table OR duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- 3. Row level security: scope to the user's companies
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read access to all authenticated users on asset_categories" ON public.asset_categories;
DROP POLICY IF EXISTS "Allow write to masters for Admin/Management on asset_categories" ON public.asset_categories;
DROP POLICY IF EXISTS "Allow write to masters for Admin/Management" ON public.asset_categories;
DROP POLICY IF EXISTS "Allow insert masters for Admin/Management" ON public.asset_categories;
DROP POLICY IF EXISTS "Allow update masters for Admin/Management" ON public.asset_categories;
DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.asset_categories;
DROP POLICY IF EXISTS "Users read categories in their companies" ON public.asset_categories;
DROP POLICY IF EXISTS "Admin/Mgmt manage categories in their companies" ON public.asset_categories;

CREATE POLICY "Users read categories in their companies" ON public.asset_categories
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Admin/Mgmt manage categories in their companies" ON public.asset_categories
  FOR ALL TO authenticated
  USING (public.has_company_access(company_id) AND public.get_user_role() IN ('Superadmin', 'Admin', 'Management'))
  WITH CHECK (public.has_company_access(company_id) AND public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

-- 4. Refresh PostgREST's schema cache so the new column is visible immediately
NOTIFY pgrst, 'reload schema';
