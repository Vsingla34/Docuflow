-- ============================================================================
-- Docuflow Workflow Tables: Procurement
-- ============================================================================

-- ENUMS
DO $$ BEGIN
  CREATE TYPE doc_status AS ENUM ('Draft', 'Pending Approval', 'Approved', 'Rejected', 'Cancelled', 'Partially Received', 'Received', 'Closed', 'In Transit', 'Completed', 'Issued', 'Returned', 'Overdue', 'Active', 'Expired', 'Terminated', 'Renewed', 'Open', 'In Progress', 'Sent to Vendor', 'Posted', 'Planned', 'Signed Off', 'Converted to PO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 1. Requisitions
CREATE TABLE IF NOT EXISTS public.requisitions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  pr_no TEXT NOT NULL,
  status doc_status NOT NULL DEFAULT 'Draft',
  requested_by_id UUID REFERENCES public.employees(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  location_id UUID REFERENCES public.locations(id) NOT NULL,
  required_by DATE NOT NULL,
  justification TEXT NOT NULL,
  estimated_value NUMERIC NOT NULL,
  po_id UUID, -- References purchase_orders later
  po_no TEXT,
  created_on TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.requisition_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  requisition_id UUID REFERENCES public.requisitions(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.asset_categories(id) NOT NULL,
  variant_id UUID REFERENCES public.asset_variants(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  estimated_unit_cost NUMERIC NOT NULL,
  for_employee_id UUID REFERENCES public.employees(id)
);

-- 2. Purchase Orders
CREATE TABLE IF NOT EXISTS public.purchase_orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  po_no TEXT NOT NULL,
  pr_id UUID REFERENCES public.requisitions(id),
  pr_no TEXT,
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  status doc_status NOT NULL DEFAULT 'Draft',
  order_date DATE NOT NULL,
  expected_delivery_date DATE NOT NULL,
  deliver_to_location_id UUID REFERENCES public.locations(id) NOT NULL,
  department_id UUID REFERENCES public.departments(id) NOT NULL,
  sub_total NUMERIC NOT NULL,
  tax_total NUMERIC NOT NULL,
  grand_total NUMERIC NOT NULL,
  payment_terms TEXT NOT NULL,
  warranty_terms TEXT NOT NULL,
  created_by_id UUID REFERENCES public.employees(id) NOT NULL,
  remarks TEXT
);

-- Update FK for requisitions
ALTER TABLE public.requisitions ADD CONSTRAINT fk_req_po FOREIGN KEY (po_id) REFERENCES public.purchase_orders(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.purchase_order_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.asset_categories(id) NOT NULL,
  variant_id UUID REFERENCES public.asset_variants(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  tax_percent NUMERIC NOT NULL,
  received_qty NUMERIC NOT NULL DEFAULT 0
);

-- 3. Goods Receipt Notes (GRN)
CREATE TABLE IF NOT EXISTS public.grns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  grn_no TEXT NOT NULL,
  po_id UUID REFERENCES public.purchase_orders(id) NOT NULL,
  po_no TEXT NOT NULL,
  vendor_id UUID REFERENCES public.vendors(id) NOT NULL,
  status doc_status NOT NULL DEFAULT 'Posted',
  received_date DATE NOT NULL,
  challan_no TEXT NOT NULL,
  challan_date DATE NOT NULL,
  received_by_id UUID REFERENCES public.employees(id) NOT NULL,
  inspection_remarks TEXT
);

CREATE TABLE IF NOT EXISTS public.grn_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  grn_id UUID REFERENCES public.grns(id) ON DELETE CASCADE NOT NULL,
  po_line_id UUID REFERENCES public.purchase_order_lines(id) NOT NULL,
  category_id UUID REFERENCES public.asset_categories(id) NOT NULL,
  variant_id UUID REFERENCES public.asset_variants(id),
  description TEXT NOT NULL,
  ordered_qty NUMERIC NOT NULL,
  received_qty NUMERIC NOT NULL,
  accepted_qty NUMERIC NOT NULL,
  rejected_qty NUMERIC NOT NULL DEFAULT 0,
  rejection_reason TEXT
);

-- 4. Audit Plans
CREATE TABLE IF NOT EXISTS public.audit_plans (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  audit_no TEXT NOT NULL,
  title TEXT NOT NULL,
  status doc_status NOT NULL DEFAULT 'In Progress',
  auditor_id UUID REFERENCES public.employees(id) NOT NULL,
  planned_date DATE NOT NULL,
  scope_type TEXT NOT NULL, -- 'Location', 'Department', 'Category', 'All'
  observations TEXT,
  signed_off_by TEXT,
  signed_off_on DATE,
  created_on DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS public.verification_lines (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  audit_plan_id UUID REFERENCES public.audit_plans(id) ON DELETE CASCADE NOT NULL,
  asset_id UUID REFERENCES public.assets(id) NOT NULL,
  expected_location_id UUID REFERENCES public.locations(id) NOT NULL,
  expected_custodian_id UUID REFERENCES public.employees(id),
  actual_location_id UUID REFERENCES public.locations(id),
  actual_custodian_id UUID REFERENCES public.employees(id),
  result TEXT NOT NULL, -- 'Pending', 'Found', 'Missing', 'Location Mismatch', 'Custodian Mismatch'
  verified_on DATE
);
