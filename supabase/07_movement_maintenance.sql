-- ============================================================================
-- Docuflow Workflow Tables: Movement & Maintenance
-- ============================================================================

-- 1. Transfers
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  transfer_no TEXT NOT NULL,
  status doc_status NOT NULL DEFAULT 'Draft',
  from_location_id UUID REFERENCES public.locations(id) NOT NULL,
  to_location_id UUID REFERENCES public.locations(id) NOT NULL,
  requested_by_id UUID REFERENCES public.employees(id) NOT NULL,
  reason TEXT NOT NULL,
  dispatched_by_id UUID REFERENCES public.employees(id),
  dispatched_on DATE,
  received_by_id UUID REFERENCES public.employees(id),
  received_on DATE,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.transfer_assets (
  transfer_id UUID REFERENCES public.transfers(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) NOT NULL,
  PRIMARY KEY (transfer_id, asset_id)
);

-- 2. Gate Passes
CREATE TABLE IF NOT EXISTS public.gate_passes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  pass_no TEXT NOT NULL,
  type TEXT NOT NULL, -- 'Returnable', 'Non-Returnable'
  status doc_status NOT NULL DEFAULT 'Draft',
  requested_by_id UUID REFERENCES public.employees(id) NOT NULL,
  location_id UUID REFERENCES public.locations(id) NOT NULL,
  purpose TEXT NOT NULL,
  destination TEXT NOT NULL,
  expected_return_date DATE,
  issued_by_id UUID REFERENCES public.employees(id),
  issued_on DATE,
  returned_on DATE,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.gate_pass_assets (
  gate_pass_id UUID REFERENCES public.gate_passes(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) NOT NULL,
  PRIMARY KEY (gate_pass_id, asset_id)
);

-- 3. AMC Contracts
CREATE TABLE IF NOT EXISTS public.amc_contracts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  contract_no TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  title TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  cost NUMERIC NOT NULL,
  status doc_status NOT NULL DEFAULT 'Active',
  payment_terms TEXT NOT NULL,
  preventive_visits_per_year NUMERIC NOT NULL,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.amc_contract_assets (
  amc_contract_id UUID REFERENCES public.amc_contracts(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) NOT NULL,
  PRIMARY KEY (amc_contract_id, asset_id)
);

CREATE TABLE IF NOT EXISTS public.amc_visits (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  contract_id UUID REFERENCES public.amc_contracts(id) ON DELETE CASCADE NOT NULL,
  visit_date DATE NOT NULL,
  engineer_name TEXT NOT NULL,
  findings TEXT NOT NULL,
  status doc_status NOT NULL DEFAULT 'Completed',
  recorded_by_id UUID REFERENCES public.employees(id) NOT NULL
);

-- 4. Service Tickets
CREATE TABLE IF NOT EXISTS public.service_tickets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  ticket_no TEXT NOT NULL,
  asset_id UUID REFERENCES public.assets(id) NOT NULL,
  reported_by_id UUID REFERENCES public.employees(id) NOT NULL,
  issue_description TEXT NOT NULL,
  priority TEXT NOT NULL, -- 'High', 'Medium', 'Low'
  status doc_status NOT NULL DEFAULT 'Open',
  assigned_vendor_id UUID REFERENCES public.vendors(id),
  estimated_cost NUMERIC,
  actual_cost NUMERIC,
  resolution TEXT,
  resolved_on DATE,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Replacements
CREATE TABLE IF NOT EXISTS public.replacements (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  replacement_no TEXT NOT NULL,
  old_asset_id UUID REFERENCES public.assets(id) NOT NULL,
  requested_by_id UUID REFERENCES public.employees(id) NOT NULL,
  reason TEXT NOT NULL,
  status doc_status NOT NULL DEFAULT 'Draft',
  new_asset_id UUID REFERENCES public.assets(id),
  completed_on DATE,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 6. Disposals
CREATE TABLE IF NOT EXISTS public.disposals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  disposal_no TEXT NOT NULL,
  asset_id UUID REFERENCES public.assets(id) NOT NULL,
  requested_by_id UUID REFERENCES public.employees(id) NOT NULL,
  method TEXT NOT NULL, -- 'Sale', 'Scrap', 'Donation', 'E-Waste'
  reason TEXT NOT NULL,
  status doc_status NOT NULL DEFAULT 'Draft',
  salvage_value NUMERIC NOT NULL,
  sold_to TEXT,
  completed_on DATE,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
