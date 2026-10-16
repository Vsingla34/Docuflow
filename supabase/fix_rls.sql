-- Run this in the Supabase SQL Editor to fix RLS policies for Locations and Departments

-- Drop existing policies that might be conflicting
DROP POLICY IF EXISTS "Allow write to masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow insert masters for Admin/Management" ON public.locations;
DROP POLICY IF EXISTS "Allow update masters for Admin/Management" ON public.locations;

DROP POLICY IF EXISTS "Allow write to masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow delete masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow insert masters for Admin/Management" ON public.departments;
DROP POLICY IF EXISTS "Allow update masters for Admin/Management" ON public.departments;

-- Explicitly recreate separate INSERT, UPDATE, and DELETE policies for Locations
CREATE POLICY "Allow insert masters for Admin/Management" ON public.locations 
FOR INSERT TO authenticated 
WITH CHECK (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

CREATE POLICY "Allow update masters for Admin/Management" ON public.locations 
FOR UPDATE TO authenticated 
USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

CREATE POLICY "Allow delete masters for Admin/Management" ON public.locations 
FOR DELETE TO authenticated 
USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

-- Explicitly recreate separate INSERT, UPDATE, and DELETE policies for Departments
CREATE POLICY "Allow insert masters for Admin/Management" ON public.departments 
FOR INSERT TO authenticated 
WITH CHECK (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

CREATE POLICY "Allow update masters for Admin/Management" ON public.departments 
FOR UPDATE TO authenticated 
USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

CREATE POLICY "Allow delete masters for Admin/Management" ON public.departments 
FOR DELETE TO authenticated 
USING (public.get_user_role() IN ('Superadmin', 'Admin', 'Management'));

-- Just in case, ensure the read policy is present
DROP POLICY IF EXISTS "Allow read access to all authenticated users on locations" ON public.locations;
CREATE POLICY "Allow read access to all authenticated users on locations" ON public.locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow read access to all authenticated users on departments" ON public.departments;
CREATE POLICY "Allow read access to all authenticated users on departments" ON public.departments FOR SELECT TO authenticated USING (true);
