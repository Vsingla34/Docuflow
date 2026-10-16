-- Add display_id column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS display_id TEXT;
