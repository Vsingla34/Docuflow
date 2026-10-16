-- ============================================================================
-- Docuflow Remaining Workflow Tables: Projects & Components
-- ============================================================================

-- ENUMS
DO $$ BEGIN
  CREATE TYPE project_status AS ENUM ('Draft', 'In Progress', 'Completed', 'Cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 1. Asset Components
CREATE TABLE IF NOT EXISTS public.asset_components (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  part_number TEXT,
  serial_number TEXT,
  category_id UUID REFERENCES public.asset_categories(id),
  cost NUMERIC NOT NULL,
  installed_on DATE NOT NULL,
  removed_on DATE,
  status TEXT NOT NULL, -- 'Installed', 'Removed', 'Faulty', 'Replaced'
  warranty_expiry DATE,
  replaced_by_component_id UUID, -- Self reference, can't easily FK without deferring
  source TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Projects (CWIP)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  project_no TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  status project_status NOT NULL DEFAULT 'Draft',
  budget NUMERIC NOT NULL,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  manager_id UUID REFERENCES public.employees(id) NOT NULL,
  location_id UUID REFERENCES public.locations(id) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  completed_on DATE,
  result_asset_id UUID REFERENCES public.assets(id),
  created_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Project Entries
CREATE TABLE IF NOT EXISTS public.project_entries (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT NOT NULL,
  recorded_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.asset_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Tenant read components" ON public.asset_components FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "Tenant manage components" ON public.asset_components FOR ALL TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Tenant read projects" ON public.projects FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "Tenant manage projects" ON public.projects FOR ALL TO authenticated USING (public.has_company_access(company_id));

CREATE POLICY "Tenant read project_entries" ON public.project_entries FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "Tenant manage project_entries" ON public.project_entries FOR ALL TO authenticated USING (public.has_company_access(company_id));
