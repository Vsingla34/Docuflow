-- ============================================================================
-- Phase 1: Database Foundation for Multi-Company (Multi-Tenant) Architecture
-- ============================================================================

-- 1. Create the Companies Table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert a default company to attach existing data to
INSERT INTO public.companies (id, name, code) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Default Company', 'DEFAULT')
ON CONFLICT (code) DO NOTHING;

-- 2. Create the User-Companies Junction Table
CREATE TABLE IF NOT EXISTS public.user_companies (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (user_id, company_id)
);

-- 3. Add company_id to existing isolated tables
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.vendors ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.assets ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.upload_history ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) DEFAULT '00000000-0000-0000-0000-000000000001';

-- Make company_id NOT NULL now that existing rows have a default
ALTER TABLE public.departments ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.locations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.vendors ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.employees ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.assets ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.upload_history ALTER COLUMN company_id SET NOT NULL;

-- Enable RLS on new tables
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Phase 2: RLS Policies for Multi-Tenancy
-- ============================================================================

-- Helper Function: Check if user has access to a specific company
CREATE OR REPLACE FUNCTION public.has_company_access(c_id UUID)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies 
    WHERE user_id = auth.uid() AND company_id = c_id
  ) OR public.get_user_role() = 'Superadmin';
$$;

-- Helper Function: Check if user is Superadmin (can see all companies)
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(public.get_user_role() = 'Superadmin', false);
$$;

---------------------------------------------------
-- Policies for Companies & User-Companies
---------------------------------------------------
DROP POLICY IF EXISTS "Users can read assigned companies" ON public.companies;
CREATE POLICY "Users can read assigned companies" ON public.companies
FOR SELECT TO authenticated USING (public.has_company_access(id));

DROP POLICY IF EXISTS "Superadmin can manage companies" ON public.companies;
CREATE POLICY "Superadmin can manage companies" ON public.companies
FOR ALL TO authenticated USING (public.is_superadmin());

DROP POLICY IF EXISTS "Users can read own assignments" ON public.user_companies;
CREATE POLICY "Users can read own assignments" ON public.user_companies
FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_superadmin());

DROP POLICY IF EXISTS "Superadmin can manage assignments" ON public.user_companies;
CREATE POLICY "Superadmin can manage assignments" ON public.user_companies
FOR ALL TO authenticated USING (public.is_superadmin());

---------------------------------------------------
-- Policies for Master Data (Locations, Departments, Vendors)
---------------------------------------------------
-- LOCATIONS
DROP POLICY IF EXISTS "Allow read access to all authenticated users on locations" ON public.locations;
DROP POLICY IF EXISTS "Allow insert masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow update masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.locations;

CREATE POLICY "Users read locations in their companies" ON public.locations
FOR SELECT TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Admin/Mgmt manage locations in their companies" ON public.locations
FOR ALL TO authenticated USING (
  public.has_company_access(company_id) 
  AND public.get_user_role() IN ('Superadmin', 'Admin', 'Management')
);

-- DEPARTMENTS
DROP POLICY IF EXISTS "Allow read access to all authenticated users on departments" ON public.departments;
DROP POLICY IF EXISTS "Allow insert masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow update masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.departments;

CREATE POLICY "Users read departments in their companies" ON public.departments
FOR SELECT TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Admin/Mgmt manage departments in their companies" ON public.departments
FOR ALL TO authenticated USING (
  public.has_company_access(company_id) 
  AND public.get_user_role() IN ('Superadmin', 'Admin', 'Management')
);

-- VENDORS
DROP POLICY IF EXISTS "Allow read access to all authenticated users on vendors" ON public.vendors;
DROP POLICY IF EXISTS "Allow write to masters for Admin/Management" ON public.vendors;

CREATE POLICY "Users read vendors in their companies" ON public.vendors
FOR SELECT TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Admin/Mgmt manage vendors in their companies" ON public.vendors
FOR ALL TO authenticated USING (
  public.has_company_access(company_id) 
  AND public.get_user_role() IN ('Superadmin', 'Admin', 'Management')
);

-- EMPLOYEES
DROP POLICY IF EXISTS "Allow read access to all authenticated users on employees" ON public.employees;

CREATE POLICY "Users read employees in their companies" ON public.employees
FOR SELECT TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Admin/Mgmt manage employees in their companies" ON public.employees
FOR ALL TO authenticated USING (
  public.has_company_access(company_id) 
  AND public.get_user_role() IN ('Superadmin', 'Admin', 'Management')
);

-- ASSETS
DROP POLICY IF EXISTS "Allow read access to all authenticated users on assets" ON public.assets;
DROP POLICY IF EXISTS "Allow write to assets for Admin/Management" ON public.assets;

CREATE POLICY "Users read assets in their companies" ON public.assets
FOR SELECT TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Admin/Mgmt manage assets in their companies" ON public.assets
FOR ALL TO authenticated USING (
  public.has_company_access(company_id) 
  AND public.get_user_role() IN ('Superadmin', 'Admin', 'Management')
);

-- UPLOAD HISTORY
DROP POLICY IF EXISTS "Allow read access to all authenticated users on upload_history" ON public.upload_history;
DROP POLICY IF EXISTS "Allow write to upload_history for Admin/Management/Superadmin" ON public.upload_history;

CREATE POLICY "Users read upload_history in their companies" ON public.upload_history
FOR SELECT TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Admin/Mgmt manage upload_history in their companies" ON public.upload_history
FOR ALL TO authenticated USING (
  public.has_company_access(company_id) 
  AND public.get_user_role() IN ('Superadmin', 'Admin', 'Management')
);
