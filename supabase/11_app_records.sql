-- ============================================================================
-- Docuflow: app_records  --  database storage for ALL transactional / workflow data
-- (requisitions, purchase orders, GRNs, transfers, gate passes, AMC, service tickets,
--  replacements, disposals, DOA rules & delegations, audits, CWIP projects, custom roles,
--  asset components, activity log, document counters, asset history).
--
-- One row per record, scoped to a company. Safe to run more than once.
-- Run in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.app_records (
  seq        BIGINT GENERATED ALWAYS AS IDENTITY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  collection TEXT NOT NULL,
  id         TEXT NOT NULL,
  data       JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (company_id, collection, id)
);

CREATE INDEX IF NOT EXISTS app_records_company_collection_seq_idx
  ON public.app_records (company_id, collection, seq DESC);

-- keep updated_at fresh on every upsert
CREATE OR REPLACE FUNCTION public.app_records_touch()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS app_records_touch ON public.app_records;
CREATE TRIGGER app_records_touch BEFORE UPDATE ON public.app_records
  FOR EACH ROW EXECUTE FUNCTION public.app_records_touch();

-- Row level security: any member of the company can read and write its records
ALTER TABLE public.app_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members read app_records"   ON public.app_records;
DROP POLICY IF EXISTS "Company members insert app_records" ON public.app_records;
DROP POLICY IF EXISTS "Company members update app_records" ON public.app_records;
DROP POLICY IF EXISTS "Company members delete app_records" ON public.app_records;

CREATE POLICY "Company members read app_records" ON public.app_records
  FOR SELECT TO authenticated USING (public.has_company_access(company_id));
CREATE POLICY "Company members insert app_records" ON public.app_records
  FOR INSERT TO authenticated WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "Company members update app_records" ON public.app_records
  FOR UPDATE TO authenticated USING (public.has_company_access(company_id)) WITH CHECK (public.has_company_access(company_id));
CREATE POLICY "Company members delete app_records" ON public.app_records
  FOR DELETE TO authenticated USING (public.has_company_access(company_id));

-- Make the table visible to the API immediately
NOTIFY pgrst, 'reload schema';
