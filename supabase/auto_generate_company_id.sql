-- Create a sequence for the company ID
CREATE SEQUENCE IF NOT EXISTS company_display_id_seq START 1;

-- Backfill existing companies that don't have a display_id
UPDATE public.companies 
SET display_id = 'COMP' || LPAD(nextval('company_display_id_seq')::text, 4, '0') 
WHERE display_id IS NULL OR display_id = '';

-- Set the default value for the display_id column so new companies get it automatically
ALTER TABLE public.companies 
ALTER COLUMN display_id SET DEFAULT 'COMP' || LPAD(nextval('company_display_id_seq')::text, 4, '0');
