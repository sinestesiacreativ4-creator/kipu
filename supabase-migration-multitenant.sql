-- ========================================
-- MIGRACIÓN A MULTI-TENANT
-- ========================================

-- 1. Crear tabla de organizaciones
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subdomain TEXT UNIQUE,
  logo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Borrar tablas anteriores (si existen) para recrearlas
DROP TABLE IF EXISTS recordings CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 3. Recrear tabla de perfiles con organization_id
CREATE TABLE profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  avatar_color TEXT NOT NULL,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Recrear tabla de grabaciones con organization_id
CREATE TABLE recordings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  audio_base64 TEXT,
  duration INTEGER NOT NULL,
  created_at_ts BIGINT NOT NULL,
  status TEXT NOT NULL,
  markers JSONB DEFAULT '[]',
  analysis JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Índices para mejorar rendimiento
CREATE INDEX idx_profiles_organization_id ON profiles(organization_id);
CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_organization_id ON recordings(organization_id);

-- 6. Row Level Security (RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordings ENABLE ROW LEVEL SECURITY;

-- 7. Políticas de seguridad (temporales - permisivas para desarrollo)
-- NOTA: Cuando implementemos Auth, las cambiaremos para filtrar por organization_id del usuario

CREATE POLICY "Allow all for organizations" 
ON organizations FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all for profiles" 
ON profiles FOR ALL 
USING (true) 
WITH CHECK (true);

CREATE POLICY "Allow all for recordings" 
ON recordings FOR ALL 
USING (true) 
WITH CHECK (true);

-- 8. Crear organización de prueba
INSERT INTO organizations (id, name, subdomain)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Organización Demo',
  'demo'
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- LISTO: Ahora tu base de datos está lista para Multi-Tenant
-- ========================================
