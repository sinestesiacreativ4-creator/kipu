-- =============================================================================
-- MULTI-TENANT SETUP WITH ORGANIZATION SLUGS
-- =============================================================================
-- This script adds multi-tenancy support to the application by introducing
-- organization slugs for login and ensuring proper data isolation.

-- Step 1: Add 'slug' and 'logo_url' columns to organizations table
ALTER TABLE organizations 
ADD COLUMN IF NOT EXISTS slug TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- Step 2: Create index on slug for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- Step 3: Update existing organization (if it exists)
UPDATE organizations 
SET 
  name = 'Asesorías Étnicas',
  slug = 'asesorias',
  logo_url = '/kipu_logo.png'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Step 4: Insert default organization if it doesn't exist
INSERT INTO organizations (id, name, slug, logo_url, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Asesorías Étnicas',
  'asesorias',
  '/kipu_logo.png',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Step 5: Insert demo organization for testing
INSERT INTO organizations (id, name, slug, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Empresa Demo',
  'demo',
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- Step 6: Verify setup
SELECT * FROM organizations ORDER BY created_at;

-- =============================================================================
-- NOTES:
-- =============================================================================
-- - Each organization now has a unique 'slug' for login (e.g., 'asesorias', 'demo')
-- - The 'logo_url' field allows custom branding per organization
-- - Profiles and recordings are already linked to organization_id
-- - RLS policies should be configured to enforce data isolation
-- =============================================================================
