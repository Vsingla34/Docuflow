-- ============================================================================
-- Docuflow Master Tables: Asset Variants
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.asset_variants (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.asset_categories(id) ON DELETE CASCADE NOT NULL,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  specifications JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add foreign key back to assets if needed
DO $$ BEGIN
  ALTER TABLE public.assets ADD CONSTRAINT fk_asset_variant FOREIGN KEY (variant_id) REFERENCES public.asset_variants(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null;
END $$;

ALTER TABLE public.asset_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all authenticated users on asset_variants" ON public.asset_variants FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow write to masters for Admin/Management on asset_variants" ON public.asset_variants FOR ALL TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));
