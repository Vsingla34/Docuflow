-- ============================================================================
-- Docuflow Workflow Tables: RLS Policies
-- ============================================================================

-- Apply RLS to Procurement tables
ALTER TABLE public.requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requisition_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_lines ENABLE ROW LEVEL SECURITY;

-- Apply RLS to Movement & Maintenance tables
ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gate_pass_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_contract_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.amc_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replacements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disposals ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- POLICIES
-- We use the existing function: public.has_company_access(company_id)
-- ---------------------------------------------------------------------------

-- Requisitions
CREATE POLICY "Users can view requisitions in their companies"
  ON public.requisitions FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can create requisitions in their companies"
  ON public.requisitions FOR INSERT
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can update requisitions in their companies"
  ON public.requisitions FOR UPDATE
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can delete requisitions in their companies"
  ON public.requisitions FOR DELETE
  USING (public.has_company_access(company_id));

-- Requisition Lines
CREATE POLICY "Users can access requisition lines via parent"
  ON public.requisition_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.requisitions r
      WHERE r.id = requisition_lines.requisition_id
      AND public.has_company_access(r.company_id)
    )
  );

-- Purchase Orders
CREATE POLICY "Users can view purchase_orders in their companies"
  ON public.purchase_orders FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can create purchase_orders in their companies"
  ON public.purchase_orders FOR INSERT
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can update purchase_orders in their companies"
  ON public.purchase_orders FOR UPDATE
  USING (public.has_company_access(company_id))
  WITH CHECK (public.has_company_access(company_id));

CREATE POLICY "Users can delete purchase_orders in their companies"
  ON public.purchase_orders FOR DELETE
  USING (public.has_company_access(company_id));

-- Purchase Order Lines
CREATE POLICY "Users can access po lines via parent"
  ON public.purchase_order_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.purchase_orders p
      WHERE p.id = purchase_order_lines.purchase_order_id
      AND public.has_company_access(p.company_id)
    )
  );

-- GRNs
CREATE POLICY "Users can view grns in their companies"
  ON public.grns FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage grns in their companies"
  ON public.grns FOR ALL
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can access grn lines via parent"
  ON public.grn_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.grns g
      WHERE g.id = grn_lines.grn_id
      AND public.has_company_access(g.company_id)
    )
  );

-- Audit Plans
CREATE POLICY "Users can view audit_plans in their companies"
  ON public.audit_plans FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage audit_plans in their companies"
  ON public.audit_plans FOR ALL
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can access verification lines via parent"
  ON public.verification_lines FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.audit_plans a
      WHERE a.id = verification_lines.audit_plan_id
      AND public.has_company_access(a.company_id)
    )
  );

-- Transfers
CREATE POLICY "Users can view transfers in their companies"
  ON public.transfers FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage transfers in their companies"
  ON public.transfers FOR ALL
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can access transfer_assets via parent"
  ON public.transfer_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.transfers t
      WHERE t.id = transfer_assets.transfer_id
      AND public.has_company_access(t.company_id)
    )
  );

-- Gate Passes
CREATE POLICY "Users can view gate_passes in their companies"
  ON public.gate_passes FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage gate_passes in their companies"
  ON public.gate_passes FOR ALL
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can access gate_pass_assets via parent"
  ON public.gate_pass_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.gate_passes g
      WHERE g.id = gate_pass_assets.gate_pass_id
      AND public.has_company_access(g.company_id)
    )
  );

-- AMC Contracts
CREATE POLICY "Users can view amc_contracts in their companies"
  ON public.amc_contracts FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage amc_contracts in their companies"
  ON public.amc_contracts FOR ALL
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can access amc_contract_assets via parent"
  ON public.amc_contract_assets FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.amc_contracts a
      WHERE a.id = amc_contract_assets.amc_contract_id
      AND public.has_company_access(a.company_id)
    )
  );

CREATE POLICY "Users can view amc_visits in their companies"
  ON public.amc_visits FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage amc_visits in their companies"
  ON public.amc_visits FOR ALL
  USING (public.has_company_access(company_id));

-- Service Tickets
CREATE POLICY "Users can view service_tickets in their companies"
  ON public.service_tickets FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage service_tickets in their companies"
  ON public.service_tickets FOR ALL
  USING (public.has_company_access(company_id));

-- Replacements
CREATE POLICY "Users can view replacements in their companies"
  ON public.replacements FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage replacements in their companies"
  ON public.replacements FOR ALL
  USING (public.has_company_access(company_id));

-- Disposals
CREATE POLICY "Users can view disposals in their companies"
  ON public.disposals FOR SELECT
  USING (public.has_company_access(company_id));

CREATE POLICY "Users can manage disposals in their companies"
  ON public.disposals FOR ALL
  USING (public.has_company_access(company_id));
