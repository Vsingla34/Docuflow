-- Run this in your Supabase SQL Editor to add the missing Sub Location types to the location_type enum

ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'Floor';
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'Room';
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'Zone';
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'Building';
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'Desk';
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'Dock';
