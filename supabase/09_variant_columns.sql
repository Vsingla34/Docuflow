-- ============================================================================
-- Docuflow: extra columns on asset_variants so the full AssetVariant record
-- (code, name, cost, warranty, UOM, active) can be stored in the database.
-- Safe to run more than once.
-- ============================================================================

ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS standard_cost NUMERIC DEFAULT 0;
ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS warranty_months INTEGER DEFAULT 0;
ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS uom TEXT DEFAULT 'Nos';
ALTER TABLE public.asset_variants ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT true;
