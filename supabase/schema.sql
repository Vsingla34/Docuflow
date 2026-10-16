-- -----------------------------------------------------------------------------
-- Docuflow Fixed Assets Database Schema & RLS Policies
-- Execute this in the Supabase SQL Editor
-- -----------------------------------------------------------------------------

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('Superadmin', 'Admin', 'Management', 'Employee', 'Auditor');
CREATE TYPE employee_status AS ENUM ('Active', 'On Leave', 'Exited');
CREATE TYPE location_type AS ENUM ('Head Office', 'Branch', 'Warehouse / Store', 'Plant', 'Client Site', 'Remote / WFH', 'Floor', 'Room', 'Zone', 'Building', 'Desk', 'Dock');
CREATE TYPE vendor_status AS ENUM ('Active', 'Blacklisted', 'Inactive');
CREATE TYPE depreciation_method AS ENUM ('Straight Line (SLM)', 'Written Down Value (WDV)', 'Not Depreciated');
CREATE TYPE asset_status AS ENUM ('In Store', 'In Use', 'Under Repair', 'In Transit', 'Issued Out', 'Awaiting Disposal', 'Sold', 'Scrapped', 'Written Off', 'Lost / Stolen', 'Retired');
CREATE TYPE asset_condition AS ENUM ('New', 'Good', 'Fair', 'Poor', 'Unserviceable');
CREATE TYPE criticality AS ENUM ('High', 'Medium', 'Low');

-- -----------------------------------------------------------------------------
-- TABLES
-- -----------------------------------------------------------------------------

-- 1. Departments
CREATE TABLE public.departments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  cost_center TEXT NOT NULL,
  head_employee_id UUID, -- FK added later
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Locations
CREATE TABLE public.locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type location_type NOT NULL,
  parent_id UUID REFERENCES public.locations(id),
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Employees
CREATE TABLE public.employees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  designation TEXT NOT NULL,
  grade TEXT NOT NULL,
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  location_id UUID REFERENCES public.locations(id) NOT NULL,
  reports_to UUID REFERENCES public.employees(id),
  role user_role NOT NULL DEFAULT 'Employee',
  status employee_status NOT NULL DEFAULT 'Active',
  joined_on DATE NOT NULL,
  user_id UUID REFERENCES auth.users(id), -- links to Supabase Auth
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add fk constraint back to departments
ALTER TABLE public.departments
  ADD CONSTRAINT fk_dept_head FOREIGN KEY (head_employee_id) REFERENCES public.employees(id);

-- 4. Vendors
CREATE TABLE public.vendors (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  gstin TEXT NOT NULL,
  contact_person TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  services TEXT[] NOT NULL DEFAULT '{}',
  is_amc_partner BOOLEAN NOT NULL DEFAULT false,
  rating NUMERIC NOT NULL DEFAULT 0,
  status vendor_status NOT NULL DEFAULT 'Active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Asset Categories
CREATE TABLE public.asset_categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.asset_categories(id),
  description TEXT,
  depreciation_method depreciation_method NOT NULL,
  useful_life_years NUMERIC NOT NULL,
  salvage_value_pct NUMERIC NOT NULL,
  capitalization_threshold NUMERIC NOT NULL,
  requires_amc BOOLEAN NOT NULL DEFAULT false,
  requires_serial_number BOOLEAN NOT NULL DEFAULT false,
  track_components BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Assets
CREATE TABLE public.assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_tag TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category_id UUID REFERENCES public.asset_categories(id) NOT NULL,
  variant_id UUID,
  serial_number TEXT,
  status asset_status NOT NULL DEFAULT 'In Store',
  condition asset_condition NOT NULL DEFAULT 'New',
  criticality criticality NOT NULL DEFAULT 'Low',
  
  custodian_id UUID REFERENCES public.employees(id),
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  location_id UUID REFERENCES public.locations(id) NOT NULL,
  sub_location TEXT,
  
  vendor_id UUID REFERENCES public.vendors(id),
  po_no TEXT,
  grn_no TEXT,
  invoice_no TEXT,
  
  purchase_date DATE NOT NULL,
  capitalized_on DATE NOT NULL,
  purchase_cost NUMERIC NOT NULL,
  warranty_expiry DATE,
  
  useful_life_years NUMERIC NOT NULL,
  salvage_value_pct NUMERIC NOT NULL,
  depreciation_method depreciation_method NOT NULL,
  
  amc_contract_id UUID,
  parent_asset_id UUID REFERENCES public.assets(id),
  
  insurance_policy_no TEXT,
  insurance_expiry DATE,
  
  last_verified_on DATE,
  last_verified_by TEXT,
  remarks TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role AS $$
  SELECT role FROM public.employees WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Everyone can read master data
CREATE POLICY "Allow read access to all authenticated users on departments" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to all authenticated users on locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to all authenticated users on employees" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to all authenticated users on vendors" ON public.vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to all authenticated users on categories" ON public.asset_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read access to all authenticated users on assets" ON public.assets FOR SELECT TO authenticated USING (true);

-- Only Admins, Management, and Superadmin can insert/update master data (Departments, Locations, Vendors, Categories)
CREATE POLICY "Allow write to masters for Admin/Management" ON public.departments FOR ALL TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));
CREATE POLICY "Allow write to masters for Admin/Management" ON public.locations FOR ALL TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));
CREATE POLICY "Allow write to masters for Admin/Management" ON public.vendors FOR ALL TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));
CREATE POLICY "Allow write to masters for Admin/Management" ON public.asset_categories FOR ALL TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

-- Assets can be created/updated by Admin/Management/Superadmin or when GRN is posted (we assume via edge function or Admin role)
CREATE POLICY "Allow write to assets for Admin/Management" ON public.assets FOR ALL TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

-- Note: In a full implementation, you would add policies for Employee self-service (e.g. updating their own profile, raising requisitions)
