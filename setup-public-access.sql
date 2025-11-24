-- ============================================================
-- CONFIGURACIÓN COMPLETA PARA MODO PÚBLICO (SIN AUTENTICACIÓN)
-- ============================================================
-- Ejecuta este script completo en el SQL Editor de Supabase
-- para permitir que la aplicación funcione sin login y 
-- sincronice datos entre todos los dispositivos.

-- 1. CREAR ORGANIZACIÓN PÚBLICA (si no existe)
INSERT INTO organizations (id, name, created_at)
VALUES ('00000000-0000-0000-0000-000000000000', 'Organización Pública', NOW())
ON CONFLICT (id) DO NOTHING;

-- 2. ELIMINAR TODAS LAS POLÍTICAS RESTRICTIVAS ANTIGUAS

-- Políticas de organizations
DROP POLICY IF EXISTS "Public read organizations" ON organizations;
DROP POLICY IF EXISTS "Public insert organizations" ON organizations;
DROP POLICY IF EXISTS "Public manage organizations" ON organizations;
DROP POLICY IF EXISTS "Allow authenticated to read organizations" ON organizations;
DROP POLICY IF EXISTS "Allow authenticated to insert organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;

-- Políticas de profiles
DROP POLICY IF EXISTS "Public manage profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view profiles in their org" ON profiles;
DROP POLICY IF EXISTS "Users can manage profiles in their org" ON profiles;
DROP POLICY IF EXISTS "Allow authenticated to manage profiles" ON profiles;

-- Políticas de recordings
DROP POLICY IF EXISTS "Public manage recordings" ON recordings;
DROP POLICY IF EXISTS "Users can view recordings in their org" ON recordings;
DROP POLICY IF EXISTS "Users can manage recordings in their org" ON recordings;
DROP POLICY IF EXISTS "Allow authenticated to manage recordings" ON recordings;

-- 3. CREAR POLÍTICAS PÚBLICAS PERMISIVAS
-- Nota: "FOR ALL" incluye SELECT, INSERT, UPDATE y DELETE

-- Permitir TODO en organizations (incluyendo DELETE)
CREATE POLICY "Public full access organizations"
ON organizations FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Permitir TODO en profiles (incluyendo DELETE)
CREATE POLICY "Public full access profiles"
ON profiles FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- Permitir TODO en recordings (incluyendo DELETE)
CREATE POLICY "Public full access recordings"
ON recordings FOR ALL
TO anon, authenticated
USING (true)
WITH CHECK (true);

-- 4. VERIFICACIÓN
-- Ejecuta esto después para confirmar que funcionó:
-- SELECT * FROM organizations WHERE id = '00000000-0000-0000-0000-000000000000';
-- SELECT * FROM profiles;
-- SELECT * FROM recordings;
