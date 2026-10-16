-- -----------------------------------------------------------------------------
-- Docuflow – Master Uploads History
-- Run this in the Supabase SQL Editor to support the Data Imports feature.
-- -----------------------------------------------------------------------------

-- 1. Upload History Table
CREATE TABLE IF NOT EXISTS public.upload_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  entity_type TEXT NOT NULL, -- e.g. 'Users', 'Locations', 'Departments', 'Sub Locations'
  file_name TEXT NOT NULL,
  record_count INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.upload_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access to all authenticated users on upload_history" 
  ON public.upload_history FOR SELECT TO authenticated USING (true);
  
CREATE POLICY "Allow write to upload_history for Admin/Management/Superadmin" 
  ON public.upload_history FOR ALL TO authenticated 
  USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

-- 2. Add upload_id to Master Tables for cascading deletes
ALTER TABLE public.departments ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.upload_history(id) ON DELETE CASCADE;
ALTER TABLE public.locations ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.upload_history(id) ON DELETE CASCADE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.upload_history(id) ON DELETE CASCADE;

-- If we also want to delete the profiles created during user upload, we add it to profiles too.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS upload_id UUID REFERENCES public.upload_history(id) ON DELETE CASCADE;

-- Also update existing master policies to ensure we can delete if we are Admins
-- (They might only have insert/update right now)
DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.departments;
CREATE POLICY "Allow delete masters for Admin/Management" ON public.departments FOR DELETE TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.locations;
CREATE POLICY "Allow delete masters for Admin/Management" ON public.locations FOR DELETE TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.employees;
CREATE POLICY "Allow delete masters for Admin/Management" ON public.employees FOR DELETE TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

DROP POLICY IF EXISTS "Allow delete to upload_history for Admin/Management" ON public.upload_history;
CREATE POLICY "Allow delete to upload_history for Admin/Management" ON public.upload_history FOR DELETE TO authenticated USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));
